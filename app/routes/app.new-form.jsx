import { authenticate } from '../shopify.server';
import {
  Page,
  Layout,
  Card,
  Button,
  Form,
  FormLayout,
  TextField,
  Select,
  Spinner,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import { useLoaderData, useActionData } from "@remix-run/react";
import * as remixNode from "@remix-run/node";

const {
  json,
  unstable_parseMultipartFormData,
  uploadHandler,
} = remixNode;

export const loader = async ({ request }) => {
  try {
    const [categoriesResponse, brandsResponse] = await Promise.all([
      fetch("https://customer-api.realauthentication.com/v2/categories", {
        headers: {
          Authorization: `Bearer ${process.env.RAU_API_KEY}`,
        },
      }),
      fetch("https://customer-api.realauthentication.com/v2/brands", {
        headers: {
          Authorization: `Bearer ${process.env.RAU_API_KEY}`,
        },
      }),
    ]);

    if (!categoriesResponse.ok || !brandsResponse.ok) {
      throw new Error(
        `API request failed: ${categoriesResponse.statusText || brandsResponse.statusText}`
      );
    }

    const [categories, brands] = await Promise.all([
      categoriesResponse.json(),
      brandsResponse.json(),
    ]);

    return json(
      { categories, brands },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } }
    );
  } catch (error) {
    console.error("Loader error:", error);
    return json(
      { categories: [], brands: [], error: error.message },
      { status: 500, headers: { "Cache-Control": "no-cache" } }
    );
  }
};

export default function FormPage() {
  const { categories, brands, error } = useLoaderData();
  const actionData = useActionData();
  const [image, setImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    title: "",
    brand_id: "",
    category_id: "",
    serial_number: "",
    sku: "",
  });

  const handleChange = (field) => (value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Page>
      <TitleBar title="Add Product for Authentication" />
      <Layout>
        <Layout.Section>
          <Card sectioned>
            {error && <div style={{ color: 'red', marginBottom: '1rem' }}>Error loading data: {error}</div>}
            {actionData?.success && (
              <Banner title="Order created successfully" status="success" />
            )}
            <Form method="post" encType="multipart/form-data">
              <FormLayout>
                <TextField name="email" label="Email" value={formData.email} onChange={handleChange("email")} type="email" required />
                <TextField name="title" label="Title" value={formData.title} onChange={handleChange("title")} required />
                <Select name="category_id" label="Category" options={categories.map((cat) => ({ label: cat.name, value: String(cat.id) }))} value={formData.category_id} onChange={handleChange("category_id")} required />
                <Select name="brand_id" label="Brand" options={brands.map((brand) => ({ label: brand.name, value: String(brand.id) }))} value={formData.brand_id} onChange={handleChange("brand_id")} required />
                <TextField name="serial_number" label="Serial Number" value={formData.serial_number} onChange={handleChange("serial_number")} required />
                <TextField name="sku" label="SKU" value={formData.sku} onChange={handleChange("sku")} required />
                <div style={{ margin: '1rem 0' }}>
                  <label>
                    Product Image (single allowed)
                    <input name="image" type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} style={{ marginTop: '0.5rem' }} required />
                  </label>
                  {image && <div style={{ marginTop: '0.5rem' }}>1 file selected</div>}
                </div>
                <Button submit primary loading={isSubmitting} disabled={isSubmitting}>
                  {isSubmitting ? <Spinner size="small" /> : "Submit"}
                </Button>
              </FormLayout>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

const uploadImage = async (imageFile) => {
  const form = new FormData();
  form.append("image", imageFile);
  try {
    const response = await fetch('https://customer-api.realauthentication.com/v2/images', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RAU_API_KEY}`,
      },
      body: form,
    });
    const result = await response.json();
    return result;
  } catch (err) {
    console.error("Image upload failed:", err);
    return null;
  }
};

const createOrder = async (payload) => {
  try {
    const response = await fetch('https://customer-api.realauthentication.com/v2/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RAU_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    return result;
  } catch (err) {
    console.error("Order creation failed:", err);
    return null;
  }
};

const createProduct = async (data, imageUrl, accessToken, orderId) => {
  try {
    const response = await fetch("https://authenticate-app.myshopify.com/admin/api/2023-04/products.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({
        product: {
          title: data.title,
          body_html: `Verified product from ${data.email}`,
          vendor: "RAU",
          product_type: "Authenticated Product",
          variants: [
            {
              sku: data.sku,
              price: "0.00"
            }
          ],
          images: [
            {
              src: imageUrl
            }
          ],
          metafields: [
            {
              namespace: "custom",
              key: "rau_order_id",
              type: "single_line_text_field",
              value: String(orderId)
            },
            {
              namespace: "custom",
              key: "rau_category",
              type: "single_line_text_field",
              value: String(data.category_id)
            },
            {
              namespace: "custom",
              key: "rau_brand",
              type: "single_line_text_field",
              value: String(data.brand_id)
            },
            {
              namespace: "custom",
              key: "rau_serialnumber",
              type: "single_line_text_field",
              value: String(data.serial_number)
            },
            {
              namespace: "custom",
              key: "rau_uploadstatus",
              type: "single_line_text_field",
              value: String('uploaded')
            },
            {
              namespace: "custom",
              key: "rau_authenticationstatus",
              type: "single_line_text_field",
              value: String('pending')
            }
          ]
        }
      })
    });
    const result = await response.json();
    return result;
  } catch (err) {
    console.error("Product creation failed:", err);
    return null;
  }
};

export async function action({ request }) {
  const formData = await request.formData();
  const file = formData.get("image");

  const { session } = await authenticate.admin(request);
  const accessToken = session.accessToken;

  const data = {
    title: formData.get('title'),
    email: formData.get('email'),
    category_id: parseInt(formData.get('category_id')),
    brand_id: parseInt(formData.get('brand_id')),
    serial_number: formData.get('serial_number'),
    sku: formData.get('sku')
  };

  const resp = await uploadImage(file);
  const image_id = resp?.id;
  const image_url = resp?.url;

  const payload = {
    email: data.email,
    title: data.title,
    brand_id: data.brand_id,
    category_id: data.category_id,
    documentation_name: "RA",
    web_link: "",
    note: "",
    serial_number: data.serial_number,
    sku: data.sku,
    images: [{ category_image_id: 1, image_id: image_id }]
  };

  const order = await createOrder(payload);
  
  const product = await createProduct(data, image_url, accessToken, order.id);
  console.log('order==>', order);
  console.log('product==>', product);

  return json({ success: true, data, order, product });
}