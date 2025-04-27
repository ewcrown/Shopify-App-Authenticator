import { authenticate } from '../shopify.server';
import { json } from '@remix-run/node';
import fetch from 'node-fetch';
import FormData from 'form-data';
import prisma from "../db.server";

const API_TOKEN = "Fa8eEuMYuRTLl4OMVnf10yztCIYtd5d16ezON540ZbXdampcjLd7IThtoN20";

// Upload image to external API
const uploadImage = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl);
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      throw new Error("Failed to fetch image from URL");
    }

    const form = new FormData();
    form.append("image", response.body, {
      filename: "image.jpg",
      contentType,
    });

    const uploadResponse = await fetch("https://customer-api.realauthentication.com/v2/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    const result = await uploadResponse.json();
    console.log("✅ Upload response:", result);
    return result;

  } catch (err) {
    console.error("❌ Upload failed:", err);
    throw err;
  }
};

// Create order in external API
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

const dbProduct = async () => {}


export async function action({ request }) {
  try {
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

    if (!admin) {
      throw new Response(null, { status: 401 });
    }

    switch (topic) {
      case 'PRODUCTS_CREATE': {
        console.log('📦 Product created:', payload.title);

        const successfulUploads = [];

        for (const [index, img] of (payload.images || []).entries()) {
          try {
            console.log(`➡️ Uploading image ${index + 1}/${payload.images.length}`);
            const uploadResult = await uploadImage(img.src);

            if (uploadResult?.id) {
              successfulUploads.push({
                category_image_id: index + 1,
                image_id: uploadResult.id
              });
              console.log('✅ Image uploaded successfully');
            }
          } catch (err) {
            console.error(`⚠️ Image upload failed for ${img.src}:`, err.message);
          }
        }

        if (successfulUploads.length === 0) {
          throw new Error('All image uploads failed');
        }

        const orderPayload = {
          email: 'test@test.com',
          title: payload.title || 'Untitled Product',
          brand_id: 1,
          category_id: 1,
          documentation_name: "RA",
          web_link: `https://${shop}/products/${payload.handle}`,
          note: `Imported from Shopify product ${payload.id}`,
          serial_number: payload.variants?.[0]?.sku || '',
          sku: payload.variants?.[0]?.sku || '',
          images: successfulUploads
        };

        console.log('📝 Creating order with:', orderPayload);
        
        // Create order in external system
        const orderResult = await createOrder(orderPayload);
        
        console.log('📝 orderResult with:', orderResult);

        // Save order in database
        if (orderResult?.id) {
          const newOrder = await prisma.product.create({
            data: {
              shopifyId: String(payload.id),
              title: payload.title,
              handle: payload.handle,
              order_id: orderResult.id,
            },
          });

          console.log('✅ Order saved to DB:', newOrder);
          return json({
            success: true,
            orderId: orderResult.id,
            imageCount: successfulUploads.length
          });
        } else {
          throw new Error("Failed to create order in external system");
        }
      }

      default:
        return json({ success: false, error: 'Unhandled webhook topic' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Webhook processing failed:', error);
    return json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export const loader = () => new Response(null, { status: 405 });
