export const createOrder = async (payload) => {
  try {
    const response = await fetch('https://customer-api.realauthentication.com/v2/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RAU_API_KEY}`,
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
