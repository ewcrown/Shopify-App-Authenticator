import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  try {
    const { topic, shop } = await authenticate.webhook(request);

    console.log(`✅ Webhook received: ${topic} from ${shop}`);

    // Just respond with 200 OK (required by Shopify)
    return json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

// Prevent browser GET requests
export const loader = () => new Response(null, { status: 405 });
