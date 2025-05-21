export const addServices = async (order_id, service_ids) => {
  try {
    const response = await fetch(`https://customer-api.realauthentication.com/v2/orders/${order_id}/services`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RAU_API_KEY}`,
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
