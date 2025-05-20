import {
  Page,
  Layout,
  Card,
  BlockStack,
  Select,
  Text,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";

// --- Server-side loader ---
export async function loader() {
  const token = process.env.RAU_API_KEY;

  const fetchData = async (endpoint) => {
    const res = await fetch(`https://customer-api.realauthentication.com/v2/${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Response(`Failed to fetch ${endpoint}`, { status: res.status });
    }

    return res.json();
  };

  const [categories, brands, services] = await Promise.all([
    fetchData("categories"),
    fetchData("brands"),
    fetchData("services"),
  ]);

  return json({ categories, brands, services });
}

// --- Client-side component ---
export default function AboutApiPage() {
  const { categories, brands, services } = useLoaderData();

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [copied, setCopied] = useState(false);

  const category = categories.find(c => String(c.id) === selectedCategory);
  const brand = brands.find(b => String(b.id) === selectedBrand);
  const service = services.find(s => String(s.id) === selectedService);

  const copyText = `
Category: ${category ? `${category.name} (ID: ${category.id})` : ''}
Brand: ${brand ? `${brand.name} (ID: ${brand.id})` : ''}
Service: ${service ? `${service.name} (ID: ${service.id})` : ''}
`.trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  return (
    <Page>
      <TitleBar title="About API" />
      <Layout>
        <Layout.Section>
          <Card title="Select from API Data" sectioned>
            <BlockStack gap="400">
              <Select
                label="Category"
                options={[
                  { label: "Select Category", value: "" },
                  ...categories.map(cat => ({
                    label: cat.name,
                    value: String(cat.id),
                  }))
                ]}
                value={selectedCategory}
                onChange={setSelectedCategory}
              />
              <Select
                label="Brand"
                options={[
                  { label: "Select Brand", value: "" },
                  ...brands.map(brand => ({
                    label: brand.name,
                    value: String(brand.id),
                  }))
                ]}
                value={selectedBrand}
                onChange={setSelectedBrand}
              />
              <Select
                label="Service"
                options={[
                  { label: "Select Service", value: "" },
                  ...services.map(svc => ({
                    label: `${svc.name} ($${svc.price})`,
                    value: String(svc.id),
                  }))
                ]}
                value={selectedService}
                onChange={setSelectedService}
              />

              {(category || brand || service) && (
                <Card sectioned>
                  <Text as="h3" variant="headingSm">
                    Selected Values
                  </Text>
                  {category && <p>Category: {category.name} (ID: {category.id})</p>}
                  {brand && <p>Brand: {brand.name} (ID: {brand.id})</p>}
                  {service && <p>Service: {service.name} (ID: {service.id})</p>}
                  <Button onClick={handleCopy} variant="primary">
                    {copied ? "Copied!" : "Copy All"}
                  </Button>
                </Card>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
