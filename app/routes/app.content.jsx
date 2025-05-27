// app/routes/products.jsx

import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import prisma from "../db.server";

import {
  Page,
  Layout,
  Card,
  DataTable,
  Text,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

// --- Server-side loader ---
export async function loader() {
  const products = await prisma.product.findMany({
    orderBy: { title: "asc" },
  });
  return json({ products });
}

// --- Client-side component ---
export default function ProductsPage() {
  const { products } = useLoaderData();

  const rows = products.map((p) => [
    p.shopifyId,
    p.title,
    p.handle,
    p.order_id,
    p.error_handle ? (
      <Text tone="critical" as="span">
        {p.error_handle}
      </Text>
    ) : (
      ""
    ),
  ]);

  return (
    <Page fullWidth>
      <TitleBar title="Products" />
      <Layout>
        <Layout.Section>
          <Card title="All Synced Products" sectioned>
            <Box width="100%">
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text"]}
                headings={[
                  "Shopify ID",
                  "Title",
                  "Handle",
                  "Order ID",
                  "Error",
                ]}
                rows={rows}
                footerContent={`Total products: ${products.length}`}
              />
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
