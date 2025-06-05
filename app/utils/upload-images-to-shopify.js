export const uploadImagesToShopifyProduct = async (admin, productId, imageUrls) => {
  console.log("productId==>", productId);

  const mutation = `
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          ... on MediaImage {
            id
            status
            image {
              src
              altText
            }
          }
        }
        mediaUserErrors {
          code
          field
          message
        }
      }
    }
  `;

  const media = imageUrls.map(url => ({
    alt: "Uploaded by RA",
    mediaContentType: "IMAGE",
    originalSource: url,
  }));

  const result = await admin.graphql(mutation, {
    variables: {
      productId,
      media,
    },
  });

  console.log("result ==>", result);

  if (result.body?.data?.productCreateMedia?.mediaUserErrors?.length) {
    console.warn("❌ Shopify media upload errors:", result.body.data.productCreateMedia.mediaUserErrors);
  } else {
    console.log(`✅ Uploaded ${imageUrls.length} images to Shopify product`);
  }
};
