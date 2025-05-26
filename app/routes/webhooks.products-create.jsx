import { authenticate } from '../shopify.server';
import { json } from '@remix-run/node';
import prisma from "../db.server";
import { getMetafields } from '../utils/get-metafields';
import { createOrder } from '../utils/create-order';
import { uploadImage } from '../utils/upload-image-ra';
import { getCategories } from '../utils/get-categories';
import { getServices } from '../utils/get-services';
import { addServices } from '../utils/add-service';

export async function action({ request }) {
  try {
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

    if (!admin) throw new Response(null, { status: 401 });

    switch (topic) {
      case 'PRODUCTS_CREATE': {
        const category = payload.category?.name;
        console.log('✅ Received category:', category);

        // ✅ Step 1: Prevent duplicates
        const existing = await prisma.product.findUnique({
          where: { shopifyId: String(payload.id) }
        });

        if (existing) {
          console.log('⚠️ Product already processed, skipping...');
          return json({ success: true, message: 'Already processed' }, { status: 200 });
        }

        // ✅ Step 2: Load needed data
        const [category_response, services_response] = await Promise.all([
          getCategories(),
          getServices()
        ]);

        const category_select = category_response.find(c => c.name === category);
        if (!category_select) throw new Error(`Category "${category}" not found`);

        // ✅ Step 3: Upload and match images
        const definedImagesIds = await Promise.all(
          payload.images.map(async (single) => {
            const resp = await uploadImage(single.src);
            return { id: resp.id, desc: single.alt };
          })
        );

        const category_images_array = category_select.categoryImages || [];

        const images = category_images_array
          .map((single) => {
            const matched = definedImagesIds.find(def => def.desc === single.description);
            return matched ? {
              category_image_id: single.id,
              image_id: matched.id
            } : null;
          })
          .filter(Boolean);

        // ✅ Step 4: Extract metafields
        const metafields = await getMetafields(admin, payload.id);
        const metafieldsObj = {};
        for (const { node } of metafields) {
          if (node?.key?.toLowerCase().startsWith('rau_')) {
            metafieldsObj[node.key.toLowerCase()] = node.value;
          }
        }

        console.log('🧠 Mapped metafields:', metafieldsObj);

        const brand = metafieldsObj['rau_brand'] || '';
        const get_brand = category_select.brands?.filter(b => b.name === brand) || [];
        const brand_id = get_brand[0]?.id || 2;

        const matchServicesRaw = metafieldsObj['rau_services'] || '';
        const rauServices = matchServicesRaw.includes(',')
          ? matchServicesRaw.split(',').map(s => s.trim())
          : [matchServicesRaw.trim()];

        const services_select = services_response.filter(service =>
          rauServices.includes(service.name)
        );

        const service_ids_payload = services_select.map(service => ({
          service_id: service.id
        }));

        // ✅ Step 5: Create external order
        const orderPayload = {
          email: 'test@test.com',
          title: payload.title || 'Untitled Product',
          brand_id,
          category_id: category_select.id || 2,
          documentation_name: "RA",
          web_link: `https://${shop}/products/${payload.handle}`,
          note: metafieldsObj['rau_note'] || '',
          serial_number: metafieldsObj['rau_serialnumber'] || (payload.variants?.[0]?.sku || ''),
          sku: payload.variants?.[0]?.sku || '',
          images
        };

        console.log('📦 Creating order with:', orderPayload);

        const orderResult = await createOrder(orderPayload);

        if (!orderResult?.id) {
          throw new Error("❌ Failed to create order in external system");
        }

        // ✅ Step 6: Add services and save in DB
        const add_services = await addServices(orderResult.id, service_ids_payload);
        console.log('🔗 Services added:', add_services);

        const newOrder = await prisma.product.create({
          data: {
            shopifyId: String(payload.id),
            title: payload.title,
            handle: payload.handle,
            order_id: orderResult.id,
          },
        });

        console.log('✅ Order saved to DB:', newOrder);

        // ✅ Step 7: Final response to stop retry
        return json({
          success: true,
          orderId: orderResult.id,
          imageCount: images.length
        }, { status: 200 });
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
