import { authenticate } from '../shopify.server';
import { json } from '@remix-run/node';
import prisma from "../db.server";
import { getMetafields } from '../utils/get-metafields';
import { createOrder } from '../utils/create-order';
import { uploadImage } from '../utils/upload-image-ra';
import { getCategories } from '../utils/get-categories';

export async function action({ request }) {
  try {
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

    if (!admin) {
      throw new Response(null, { status: 401 });
    }

    switch (topic) {
      case 'PRODUCTS_CREATE': {

        const match = payload.tags.match(/rau_[^,]+/);
        const rauTag = match ? match[0].replace('rau_', '') : null;

        const category = payload.category.name;
        const brand = rauTag;

        const category_response = await getCategories();

        // console.log("=================================================================================================================================================================================>")
        // console.log("payload.images==>",payload.images)
        // console.log("=================================================================================================================================================================================>")

        const definedImagesIds = await Promise.all(
          payload.images.map(async (single) => {
            const resp = await uploadImage(single.src);
            return {
              id: resp.id,
              desc: single.alt
            };
          })
        );

        const category_select = category_response.find(single => single.name === category);
        const category_images_array = category_select?.categoryImages || [];

        const images = category_images_array
        .map((single) => {
          const matched = definedImagesIds.find(def => def.desc === single.description);
          return {
            category_image_id: single.id,
            image_id: matched?.id || ''
          };
        })
        .filter(item => item.image_id !== '');

        console.log("=================================================================================================================================================================================>")
        console.log("definedImagesIds==>",definedImagesIds)
        console.log("=================================================================================================================================================================================>")

        console.log("=================================================================================================================================================================================>")
        console.log('images ==>', images);
        console.log("=================================================================================================================================================================================>")


        const get_brand = category_select.brands.filter((single)=>{
          return single.name == brand
        })
    
        console.log('get_brand', get_brand)

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
          brand_id: get_brand[0].id || 2,
          category_id: category_select.id || 2,
          documentation_name: "RA",
          web_link: `https://${shop}/products/${payload.handle}`,
          note: metafieldsObj['rau_note'] || '',
          serial_number: metafieldsObj['rau_serialnumber'] || (payload.variants?.[0]?.sku || ''),
          sku: payload.variants?.[0]?.sku || '',
          images: images,
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
            imageCount: images.length
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
