import prisma from "../db.server";
import { addServices } from "./add-service";
import { createOrder } from "./create-order";
import { getCategories } from "./get-categories";
import { getPaginatedProductsFromShopify } from "./get-products-from-shopify";
import { getServices } from "./get-services";
import { uploadImage } from "./upload-image-ra";

// Helper to wait (ms)
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export async function syncAllProducts(admin, session) {
  const shopDomain = session.shop;
  let processed = 0;
  let failed    = 0;
  const results = [];
  let cursor    = null;

  // load categories & services once
  const [categoryList, serviceList] = await Promise.all([
    getCategories(),
    getServices()
  ]);

  do {
    const { products, nextCursor } =
      await getPaginatedProductsFromShopify(admin, cursor, 50);

    for (const payload of products) {
      const shopifyId = payload.id;
      const handle    = payload.handle;

      console.log(`🔄 Attempting sync for ${shopifyId} / ${handle}`);

      // look up existing record
      const existing = await prisma.product.findUnique({
        where: { shopifyId }
      });

      // skip only if it was already successfully synced (error_handle === null)
      if (existing && existing.error_handle === null) {
        console.log(`⚠️ ${shopifyId} already OK, skipping.`);
        continue;
      }

      try {
        await delay(500); // respect rate limit

        // flatten rau_ metafields into an object
        const mf = payload.metafields.reduce((acc, { key, value }) => {
          const k = key.toLowerCase();
          if (k.startsWith("rau_")) acc[k] = value;
          return acc;
        }, {});
        console.log("🧠 Metafields:", mf);

        // SKIP if missing either rau_category or rau_brand
        if (!mf["rau_category"] || !mf["rau_brand"]) {
          console.log(
            `⚠️ Skipping ${handle} — missing ${
              !mf["rau_category"] ? "rau_category" : "rau_brand"
            }`
          );
          continue;
        }

        // lookup category by mf["rau_category"]
        const categoryEntry = categoryList.find(
          c => c.name === mf["rau_category"]
        );
        if (!categoryEntry) {
          throw new Error(`Category "${mf["rau_category"]}" not found`);
        }

        // upload & match images
        const uploads = await Promise.all(
          payload.images.map(({ src, alt }) =>
            uploadImage(src).then(r => ({ id: r.id, desc: alt }))
          )
        );
        const images = (categoryEntry.categoryImages || [])
          .map(({ id: category_image_id, description }) => {
            const match = uploads.find(u => u.desc === description);
            return match
              ? { category_image_id, image_id: match.id }
              : null;
          })
          .filter(Boolean);

        // brand lookup by mf["rau_brand"]
        const brandEntry =
          categoryEntry.brands.find(b => b.name === mf["rau_brand"]) || {};
        const brand_id = brandEntry.id || 2;

        // services payload as [{ service_id: X }, …]
        const rawServices = (mf["rau_services"] || "")
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
        const service_ids_payload = serviceList
          .filter(s => rawServices.includes(s.name))
          .map(s => ({ service_id: s.id }));

        // build & send order
        const orderPayload = {
          email:              mf["rau_email"] || "test@test.com",
          title:              payload.title || "Untitled Product",
          brand_id,
          category_id:        categoryEntry.id,
          documentation_name: "RA",
          web_link:           `https://${shopDomain}/products/${handle}`,
          note:               mf["rau_note"] || "",
          serial_number:      mf["rau_serialnumber"] || "",
          sku:                 mf["rau_sku"] || "",
          images,
        };
        console.log("📦 Creating order:", orderPayload);

        const orderResult = await createOrder(orderPayload);
        if (!orderResult?.id) throw new Error("Order creation failed");

        if (service_ids_payload.length) {
          await addServices(orderResult.id, service_ids_payload);
        }

        // upsert record (clears error_handle and writes real order_id)
        await prisma.product.upsert({
          where: { shopifyId },
          update: {
            handle,
            title:        payload.title,
            order_id:     String(orderResult.id),
            error_handle: null,
          },
          create: {
            shopifyId:    String(shopifyId),
            handle,
            title:        payload.title,
            order_id:     String(orderResult.id),
            error_handle: null,
          },
        });

        results.push({ shopifyId, success: true });
        processed++;
      } catch (err) {
        console.error(`❌ ${shopifyId}/${handle} failed:`, err.message);

        // record failure (or update existing with new error)
        await prisma.product.upsert({
          where: { shopifyId },
          update: {
            handle,
            title:        payload.title || null,
            order_id:     "0",
            error_handle: err.message || "Unknown sync error",
          },
          create: {
            shopifyId:    String(shopifyId),
            handle,
            title:        payload.title || "Unknown",
            order_id:     "0",
            error_handle: err.message || "Unknown sync error",
          },
        });

        results.push({ shopifyId, success: false, error: err.message });
        failed++;
      }
    }

    cursor = nextCursor;
  } while (cursor);

  return { processed, failed, results };
}
