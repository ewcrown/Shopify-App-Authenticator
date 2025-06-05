import fetch from 'node-fetch';
import FormData from 'form-data';

export const uploadImage = async (imageUrl, apiKey) => {
  try {
    const response = await fetch(imageUrl);
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      throw new Error("Failed to fetch image from URL");
    }

    const form = new FormData();
    form.append("image", response.body, {
      filename: "image.jpg",
      contentType,
    });

    const uploadResponse = await fetch("https://customer-api.realauthentication.com/v2/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    const result = await uploadResponse.json();
    console.log("✅ Upload response:", result);
    return result;

  } catch (err) {
    console.error("❌ Upload failed:", err);
    throw err;
  }
};