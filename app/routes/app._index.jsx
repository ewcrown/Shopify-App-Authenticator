// app/routes/index.jsx
import React, { useEffect, useState } from "react";
import { json } from "@remix-run/node";
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
import { syncAllProducts } from "../utils/syncing-product";
import prisma from "../db.server"; // ✅ Import Prisma client

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent !== "syncProducts") return null;

  const cursor = formData.get("cursor") || null;

  try {
    const { admin, session } = await authenticate.admin(request);

    // ✅ Fetch tag and apiKey from Settings
    const settings = await prisma.settings.findFirst();
    if (!settings) {
      throw new Error("Settings not found. Please set API Key and Tag in the Settings panel.");
    }

    const batchSize = 100;

    // ✅ Pass settings into syncing logic
    const result = await syncAllProducts(admin, session, cursor, batchSize, {
      tag: settings.tag,
      apiKey: settings.apiKey,
    });

    return json({ success: true, ...result });
  } catch (error) {
    console.error("Sync Action Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export default function Index() {
  const fetcher = useFetcher();
  const appBridge = useAppBridge();
  const [cursor, setCursor] = useState(null);
  const [processed, setProcessed] = useState(0);
  const [failed, setFailed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const data = fetcher.data;
    if (!data) return;

    if (data.success) {
      const totalProcessed = processed + data.processed;
      const totalFailed = failed + data.failed;

      setProcessed(totalProcessed);
      setFailed(totalFailed);

      if (data.nextCursor) {
        setCursor(data.nextCursor);
        fetcher.submit(
          { intent: "syncProducts", cursor: data.nextCursor },
          { method: "post" }
        );
      } else {
        setRunning(false);
        appBridge.toast.show(
          `✅ Done! Synced ${totalProcessed} products (${totalFailed} failed)`
        );
      }
    } else {
      setRunning(false);
      appBridge.toast.show(`❌ Error: ${data.error}`, { isError: true });
    }
  }, [fetcher.data]);

  function startSync() {
    if (running) return;
    setCursor(null);
    setProcessed(0);
    setFailed(0);
    setRunning(true);
    fetcher.submit({ intent: "syncProducts", cursor: "" }, { method: "post" });
  }

  const isLoading = running && fetcher.state === "submitting";

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
                  <Button onClick={startSync} loading={isLoading} disabled={isLoading}>
                    {isLoading ? "Syncing..." : "Sync Products from Shopify"}
                  </Button>
                </InlineStack>

                {running && (
                  <Text variant="bodyMd" tone="subdued">
                    Sync in progress… <strong>✅ {processed}</strong> successful,{" "}
                    <strong>❌ {failed}</strong> failed
                  </Text>
                )}

                {!running && processed > 0 && (
                  <Box padding="200">
                    <Text variant="bodyMd">
                      <strong>Final Results:</strong>
                      <br />
                      ✅ Successful: {processed}
                      <br />
                      ❌ Failed: {failed}
                      <br />
                      🔄 Total: {processed + failed}
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
