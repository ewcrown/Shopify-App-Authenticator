import { useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "syncProducts") {
      let hasNextPage = true;
      let afterCursor = null;
      let allProducts = [];
      let processedCount = 0;
      let failedCount = 0;
      const failedProducts = [];

      console.log("Starting product sync...");

      while (hasNextPage) {
        try {
          const query = `
            query getProducts($cursor: String) {
              products(first: 10, after: $cursor) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                edges {
                  node {
                    id
                    title
                    handle
                    status
                    images(first: 5) {
                      edges {
                        node {
                          id
                          src
                          altText
                        }
                      }
                    }
                    metafields(first: 20) {
                      edges {
                        node {
                          id
                          namespace
                          key
                          value
                          type
                        }
                      }
                    }
                  }
                }
              }
            }
          `;

          const response = await admin.graphql(query, {
            variables: { cursor: afterCursor },
          });

          const json = await response.json();
          
          if (!json?.data?.products) {
            throw new Error("Invalid products response from Shopify");
          }

          const productsConnection = json.data.products;
          const products = productsConnection.edges.map((edge) => edge.node);
          allProducts = allProducts.concat(products);

          hasNextPage = productsConnection.pageInfo.hasNextPage;
          afterCursor = productsConnection.pageInfo.endCursor;
        } catch (fetchError) {
          console.error("Error fetching products:", fetchError);
          hasNextPage = false;
          throw fetchError;
        }
      }

      console.log(`Fetched ${allProducts.length} products from Shopify`);

      const batchSize = 10;
      for (let i = 0; i < allProducts.length; i += batchSize) {
        const batch = allProducts.slice(i, i + batchSize);
        
        try {
          await prisma.$transaction(async (prisma) => {
            for (const product of batch) {
              try {
                if (!product?.id) {
                  console.warn("Skipping product with no ID:", product);
                  failedCount++;
                  failedProducts.push({
                    productId: null,
                    error: "Missing product ID"
                  });
                  continue;
                }

                const dbProduct = await prisma.product.upsert({
                  where: { shopifyId: product.id },
                  update: {
                    title: product.title || "",
                    handle: product.handle || "",
                    status: product.status || "ACTIVE",
                  },
                  create: {
                    shopifyId: product.id,
                    title: product.title || "",
                    handle: product.handle || "",
                    status: product.status || "ACTIVE",
                  },
                });

                if (product.images?.edges?.length > 0) {
                  try {
                    await prisma.image.deleteMany({ 
                      where: { productId: dbProduct.id } 
                    });

                    await prisma.image.createMany({
                      data: product.images.edges.map(({ node: image }) => ({
                        shopifyId: image.id,
                        src: image.src || "",
                        altText: image.altText || null,
                        productId: dbProduct.id,
                      })),
                    });
                  } catch (imageError) {
                    console.error(`Image processing failed for product ${product.id}:`, imageError);
                    throw imageError;
                  }
                }

                if (product.metafields?.edges?.length > 0) {
                  try {
                    const rauMetafields = product.metafields.edges
                      .map(({ node }) => node)
                      .filter(mf => mf?.key?.startsWith("rau_"));

                    if (rauMetafields.length > 0) {
                      await prisma.metafield.deleteMany({ 
                        where: { productId: dbProduct.id } 
                      });

                      await prisma.metafield.createMany({
                        data: rauMetafields.map(mf => ({
                          shopifyId: mf.id,
                          namespace: mf.namespace || "",
                          key: mf.key || "",
                          value: mf.value || "",
                          type: mf.type || "",
                          productId: dbProduct.id,
                        })),
                      });
                    }
                  } catch (metafieldError) {
                    console.error(`Metafield processing failed for product ${product.id}:`, metafieldError);
                    throw metafieldError;
                  }
                }

                processedCount++;
                console.log(`Successfully processed product ${product.id}`);
              } catch (productError) {
                console.error(`Failed to process product ${product?.id}:`, productError);
                failedCount++;
                failedProducts.push({
                  productId: product?.id,
                  error: productError.message
                });
                throw productError;
              }
            }
          });
        } catch (batchError) {
          console.error(`Batch ${i}-${i + batchSize} failed:`, batchError);
        }
      }

      console.log("Sync completed with results:", {
        total: allProducts.length,
        processed: processedCount,
        failed: failedCount,
        failedProducts
      });

      return { 
        success: true,
        stats: {
          total: allProducts.length,
          processed: processedCount,
          failed: failedCount
        },
        failedProducts: process.env.NODE_ENV === "development" ? failedProducts : undefined
      };
    }

    if (intent === "syncOrders") {
      return { message: "Order sync not implemented yet." };
    }

    return null;
  } catch (error) {
    console.error("Action failed:", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    };
  }
};


export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(
        `Synced ${fetcher.data.stats.processed} products successfully` +
        (fetcher.data.stats.failed > 0 ? ` (${fetcher.data.stats.failed} failed)` : ''),
        { duration: 5000 }
      );
    }
    if (fetcher.data?.success === false) {
      shopify.toast.show(`Sync failed: ${fetcher.data.error}`, { 
        isError: true,
        duration: 10000 
      });
      console.error("Error details:", fetcher.data);
    }
  }, [fetcher.data, shopify]);

  const syncProducts = () =>
    fetcher.submit({ intent: "syncProducts" }, { method: "POST" });

  const syncOrders = () =>
    fetcher.submit({ intent: "syncOrders" }, { method: "POST" });

  return (
    <Page>
      <TitleBar title="Admin Dashboard" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Shopify Sync Panel
                </Text>
                <InlineStack gap="300">
                  <Button 
                    onClick={syncProducts} 
                    loading={isLoading}
                    disabled={isLoading}
                    primary
                  >
                    {isLoading ? "Syncing..." : "Sync Products from Shopify"}
                  </Button>
                </InlineStack>
                
                {isLoading && (
                  <Box padding="200">
                    <Text variant="bodyMd" tone="subdued">
                      Syncing products... Please don't close this window.
                    </Text>
                    <progress />
                  </Box>
                )}

                {fetcher.data?.stats && (
                  <Box padding="200">
                    <Text variant="bodyMd">
                      <strong>Sync results:</strong><br />
                      Successful: {fetcher.data.stats.processed}<br />
                      Failed: {fetcher.data.stats.failed}<br />
                      Total processed: {fetcher.data.stats.total}
                    </Text>
                  </Box>
                )}

                {fetcher.data?.stats?.failed > 0 && (
                  <Box
                    padding="400"
                    background="bg-surface-warning"
                    borderWidth="025"
                    borderRadius="200"
                    borderColor="border-warning"
                  >
                    <Text variant="bodyMd" tone="warning">
                      <strong>Warning:</strong> {fetcher.data.stats.failed} products failed to sync.
                      {process.env.NODE_ENV === "development" && fetcher.data.failedProducts && (
                        <details>
                          <summary>Error details</summary>
                          <pre>{JSON.stringify(fetcher.data.failedProducts, null, 2)}</pre>
                        </details>
                      )}
                    </Text>
                  </Box>
                )}

                {fetcher.data?.success === false && (
                  <Box
                    padding="400"
                    background="bg-surface-critical"
                    borderWidth="025"
                    borderRadius="200"
                    borderColor="border-critical"
                  >
                    <Text variant="bodyMd" tone="critical">
                      <strong>Error:</strong> {fetcher.data.error}
                      {process.env.NODE_ENV === "development" && fetcher.data.stack && (
                        <details>
                          <summary>Stack trace</summary>
                          <pre>{fetcher.data.stack}</pre>
                        </details>
                      )}
                    </Text>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}