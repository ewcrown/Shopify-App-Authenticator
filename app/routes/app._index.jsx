// app/routes/index.tsx
import { useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { Page, Layout, Text, Card, Button, BlockStack, Box, InlineStack } from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getPaginatedProducts } from "../utils/db/get-products";
import { getSingleProduct } from "../utils/get-single-product";
// import { deleteSingleProduct } from "../utils/db/delete-single-product";

async function syncAllProducts(admin, session) {
  let page = 0;
  const pageSize = 50;
  let processed = 0;
  let failed = 0;
  const results = [];

  while (true) {
    const dbProducts = await getPaginatedProducts(page, pageSize);
    if (dbProducts.length === 0) break;

    const syncPromises = dbProducts.map(async (singleProduct) => {
      const shopifyId = singleProduct.shopifyId;
      const order_id = singleProduct.order_id;

      try {
        const shopifyProduct = await getSingleProduct(session, shopifyId, order_id);

        if (shopifyProduct) {
          results.push(shopifyProduct);
          return { success: true };
        }
      } catch (error) {
        // console.error(`Product ${shopifyId} not found on Shopify. Deleting locally.`, error);
        // await deleteSingleProduct(shopifyId);
        return { success: false };
      }
    });

    const syncResults = await Promise.all(syncPromises);

    for (const result of syncResults) {
      if (result.success) {
        processed++;
      } else {
        failed++;
      }
    }

    page++;
  }

  return { processed, failed, results };
}

// ✨ UPDATED ACTION HANDLER
export const action = async ({ request }) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "syncProducts") {
      const { processed, failed, results } = await syncAllProducts(admin, session);
      return { success: true, processed, failed, results };
    }

    if (intent === "checkAuthentication") {
      return { success: true, message: "Authentication successful!" };
    }

    return null;
  } catch (error) {
    console.error("Sync Action Error:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }
};

// ✨ UPDATED COMPONENT
export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const isLoading = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message);
    } else if (fetcher.data?.success) {
      shopify.toast.show(
        `Synced ${fetcher.data.processed} products successfully${fetcher.data.failed > 0 ? ` (${fetcher.data.failed} failed)` : ''
        }`
      );
    }

    if (fetcher.data?.success === false) {
      shopify.toast.show(`Sync failed: ${fetcher.data.error}`, { isError: true });
      console.error("Error details:", fetcher.data);
    }
  }, [fetcher.data, shopify]);

  const syncProducts = () => fetcher.submit({ intent: "syncProducts" }, { method: "POST" });
  const checkAuthentication = () => fetcher.submit({ intent: "checkAuthentication" }, { method: "POST" });

  return (
    <Page>
      <TitleBar title="Admin Dashboard" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Shopify Sync Panel</Text>
                <InlineStack gap="300">
                  <Button onClick={syncProducts} loading={isLoading} disabled={isLoading}>
                    {isLoading ? "Syncing..." : "Sync Products from Shopify"}
                  </Button>
                  {/* <Button onClick={checkAuthentication} disabled={isLoading}>
                    Check Authentication
                  </Button> */}
                </InlineStack>

                {isLoading && (
                  <Text variant="bodyMd" tone="subdued">
                    Syncing products... Please don't close this window.
                  </Text>
                )}

                {fetcher.data?.processed && (
                  <Box padding="200">
                    <Text variant="bodyMd">
                      <strong>Sync results:</strong><br />
                      Successful: {fetcher.data.processed}<br />
                      Failed: {fetcher.data.failed}<br />
                      Total processed: {fetcher.data.processed + fetcher.data.failed}
                    </Text>
                  </Box>
                )}

                {fetcher.data?.success === false && (
                  <Box padding="400" background="bg-surface-critical" borderWidth="025" borderRadius="200" borderColor="border-critical">
                    <Text variant="bodyMd" tone="critical">
                      <strong>Error:</strong> {fetcher.data.error}
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
