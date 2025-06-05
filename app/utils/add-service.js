export const addServices = async (order_id, service_ids, apiKey) => {
  try {
    const response = await fetch(`https://customer-api.realauthentication.com/v2/orders/${order_id}/services`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ services: service_ids }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to add services:", error);
    return null;
  }
};
