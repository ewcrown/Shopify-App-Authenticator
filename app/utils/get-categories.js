export const getCategories = async (apiKey) => {
  try {
    const response = await fetch("https://customer-api.realauthentication.com/v2/categories", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return null;
  }
};
