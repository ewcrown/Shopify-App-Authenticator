import { authenticate } from '../shopify.server';
import { json } from '@remix-run/node';
import prisma from "../db.server";
import { getMetafields } from '../utils/get-metafields';
import { createOrder } from '../utils/create-order';
import { uploadImage } from '../utils/upload-image-ra';

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

        // Fetch metafields
        const metafields = await getMetafields(admin, payload.id);

        // Map metafields into key:value object
        const metafieldsObj = {};
        for (const { node } of metafields) {
          if (node?.key?.toLowerCase().startsWith('rau_')) {
            metafieldsObj[node.key.toLowerCase()] = node.value;
          }
        }

        console.log('🎯 Mapped metafields:', metafieldsObj);

        // Create the order payload using metafields
        const orderPayload = {
          email: 'test@test.com', // or you can pull customer email if available
          title: payload.title || 'Untitled Product',
          brand_id: parseInt(metafieldsObj['rau_brand']) || 2,
          category_id: parseInt(metafieldsObj['rau_category']) || 2,
          documentation_name: "RA",
          web_link: `https://${shop}/products/${payload.handle}`,
          note: metafieldsObj['rau_note'] || '',
          serial_number: metafieldsObj['rau_serialnumber'] || (payload.variants?.[0]?.sku || ''),
          sku: payload.variants?.[0]?.sku || '',
          images: successfulUploads,
        };

        console.log('📝 Creating order with:', orderPayload);

        // Create order in external system
        const orderResult = await createOrder(orderPayload);

        console.log('📝 orderResult:', orderResult);

        // Save order into your database
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
