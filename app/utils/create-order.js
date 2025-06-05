export const createOrder = async (payload,apiKey) => {
  try {
    const response = await fetch('https://customer-api.realauthentication.com/v2/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
