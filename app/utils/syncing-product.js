import prisma from "../db.server";
import { addServices } from "./add-service";
import { createOrder } from "./create-order";
import { createMetafield } from "./create-metafileds";
import { getCategories } from "./get-categories";
import { getMetafields } from "./get-metafields";
import { getPaginatedProductsFromShopify } from "./get-products-from-shopify";
import { getServices } from "./get-services";
import { uploadImage } from "./upload-image-ra";
import { uploadImagesToShopifyProduct } from "./upload-images-to-shopify";

const delay = ms => new Promise(r => setTimeout(r, ms));

export async function syncAllProducts(admin, session, cursor = null, pageSize = 20, options) {
  const { apiKey, tag } = options;

  let processed = 0;
  let failed = 0;
  const results = [];

  const { products, nextCursor } = await getPaginatedProductsFromShopify(admin, cursor, pageSize, tag);
  const [categoryList, serviceList] = await Promise.all([
    getCategories(apiKey),
    getServices(apiKey),
  ]);

  let productCount = 0;
  for (const payload of products) {
    productCount++;
    if (productCount % pageSize === 0) {
      console.log(`\u23F3 Waiting 1 minute after ${pageSize} products...`);
      await delay(60000);
    }

    const tags = payload.tags.join(",")
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
        payload.images.map(({ src, alt }) =>
          uploadImage(src, apiKey).then(r => ({
            id: r.id,
            desc: alt?.trim() || null,
          }))
        )
      );

      const images = [];

      for (const { id, desc } of uploads) {
        if (desc) {
          const matched = (categoryEntry.categoryImages || []).find(c => c.description === desc);
          if (matched) {
            images.push({ category_image_id: matched.id, image_id: id });
            continue;
          }
        }
        images.push({ image_id: id });
      }

      if (images.length === 0) {
        console.log(`⚠️ Skipping ${shopifyId}/${handle} — no uploaded images`);
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
      console.log("Creating order:", orderPayload);

      const orderResult = await createOrder(orderPayload, apiKey);
      
      if (!orderResult?.id) throw new Error("Order creation failed");

      // const uploadedUrls = (orderResult.images || [])
      //   .map(img => img.image?.url)
      //   .filter(Boolean);

      // if (uploadedUrls.length > 0) {

      //   await uploadImagesToShopifyProduct(admin, shopifyId, uploadedUrls);
      // }

      if (service_ids_payload.length) {
        await addServices(orderResult.id, service_ids_payload, apiKey);
      }

      try {
        const metafields = await getMetafields(admin, shopifyId);

        const existingMfMap = {};
        for (const { node } of metafields) {
          const key = node.key.toLowerCase();
          if (key.startsWith("rau_")) {
            existingMfMap[key] = {
              id: node.id,
              value: node.value
            };
          }
        }

        const updates = {
          rau_order_id: orderResult.id,
          rau_progress: "Completed",
          rau_uploadstatus: "Uploaded",
          rau_authenticationstatus: orderResult.statusDescription || "",
          rau_note: orderResult.note || "",
          rau_serialnumber: orderResult.serialNumber || "",
          rau_order_link: `https://app.realauthentication.com/my-orders/${orderResult.id}`
        };

        for (const [key, newVal] of Object.entries(updates)) {
          await createMetafield(admin, shopifyId, key, String(newVal), "single_line_text_field", "custom");
        }

        console.log(`\u2705 Created/Updated rau_ metafields for product ${shopifyId}.`);
      } catch (mfErr) {
        console.warn(`\u26A0\uFE0F Could not create/update rau_ metafields for ${shopifyId}: ${mfErr.message}`);
      }

      await prisma.product.upsert({
        where: { shopifyId },
        update: {
          handle,
          title: payload.title,
          tags: tags,
          order_id: String(orderResult.id),
          error_handle: null,
        },
        create: {
          shopifyId: String(shopifyId),
          tags: tags,
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
          tags: tags,
          title: payload.title || null,
          order_id: "0",
          error_handle: err.message || "Unknown sync error",
        },
        create: {
          shopifyId: String(shopifyId),
          handle,
          tags: tags,
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