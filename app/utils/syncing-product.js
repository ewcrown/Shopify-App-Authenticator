import prisma from "../db.server";
import { addServices } from "./add-service";
import { createOrder } from "./create-order";
import { getCategories } from "./get-categories";
import { getPaginatedProductsFromShopify } from "./get-products-from-shopify";
import { getServices } from "./get-services";
import { uploadImage } from "./upload-image-ra";

const delay = ms => new Promise(r => setTimeout(r, ms));

export async function syncAllProducts(admin, session, cursor = null, pageSize = 20) {
  let processed = 0;
  let failed = 0;
  const results = [];

  const { products, nextCursor } = await getPaginatedProductsFromShopify(admin, cursor, pageSize);
  const [categoryList, serviceList] = await Promise.all([
    getCategories(),
    getServices(),
  ]);

  let productCount = 0;
  for (const payload of products) {
    productCount++;
    if (productCount % pageSize === 0) {
      console.log(`⏳ Waiting 1 minute after ${pageSize} products...`);
      await delay(60000);
    }

    const shopifyId = payload.id;
    const handle = payload.handle;

    const existing = await prisma.product.findUnique({ where: { shopifyId } });
    if (existing && existing.error_handle === null) continue;

    try {
      await delay(300);

      const mf = payload.metafields.reduce((acc, { key, value }) => {
        const k = key.toLowerCase();
        if (k.startsWith("rau_")) acc[k] = value;
        return acc;
      }, {});

      const categoryEntry = categoryList.find(c => c.name === mf["rau_category"]);

      if (!categoryEntry) throw new Error(`Category \"${mf["rau_category"]}\" not found`);
      const brandEntry = categoryEntry.brands.find(b => b.name === mf["rau_brand"]) || {};
      const brand_id = brandEntry.id || 2;

      const uploads = await Promise.all(
        payload.images
          .filter(({ alt }) => alt && alt.trim() !== "")
          .map(({ src, alt }) =>
            uploadImage(src).then(r => ({ id: r.id, desc: alt.trim() }))
          )
      );

      const images = (categoryEntry.categoryImages || []).map(({ id: category_image_id, description }) => {
        const m = uploads.find(u => u.desc === description);
          return m ? { category_image_id, image_id: m.id } : null;
        }).filter(Boolean);

      if (images.length === 0) {
        console.log(`⚠️ Skipping ${shopifyId}/${handle} — no matching images`);
        continue;
      }

      const rawServices = (mf["rau_services"] || "")
        .split(",").map(s => s.trim()).filter(Boolean);
      const service_ids_payload = serviceList
        .filter(s => rawServices.includes(s.name))
        .map(s => ({ service_id: s.id }));

      const orderPayload = {
        email: "Trevor@designernulimitedllc.com",
        title: payload.title || "Untitled",
        brand_id,
        category_id: categoryEntry.id,
        documentation_name: "RA",
        web_link: `https://${session.shop}/products/${handle}`,
        note: mf["rau_note"] || "",
        serial_number: mf["rau_serialnumber"] || "",
        sku: payload.sku || "",
        images,
      };
      console.log("📦 Creating order:", orderPayload);

      const orderResult = await createOrder(orderPayload);
      if (!orderResult?.id) throw new Error("Order creation failed");

      if (service_ids_payload.length) {
        await addServices(orderResult.id, service_ids_payload);
      }

      await prisma.product.upsert({
        where: { shopifyId },
        update: {
          handle,
          title: payload.title,
          order_id: String(orderResult.id),
          error_handle: null,
        },
        create: {
          shopifyId: String(shopifyId),
          handle,
          title: payload.title,
          order_id: String(orderResult.id),
          error_handle: null,
        },
      });

      processed++;
      results.push({ shopifyId, success: true });
    } catch (err) {
      await prisma.product.upsert({
        where: { shopifyId },
        update: {
          handle,
          title: payload.title || null,
          order_id: "0",
          error_handle: err.message || "Unknown sync error",
        },
        create: {
          shopifyId: String(shopifyId),
          handle,
          title: payload.title || "Unknown",
          order_id: "0",
          error_handle: err.message || "Unknown sync error",
        },
      });
      failed++;
      results.push({ shopifyId, success: false, error: err.message });
    }
  }

  return { processed, failed, results, nextCursor };
}
