export const createMetafield = async (
  admin,
  productId,
  key,
  value,
  type = "single_line_text_field",
  namespace = "custom"
) => {
  try {
    const mutation = `
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            metafields(first: 10) {
              edges {
                node {
                  id
                  key
                  namespace
                  value
                  type
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        id: productId, // Must be a GraphQL GID: gid://shopify/Product/123456789
        metafields: [
          {
            namespace,
            key,
            value: String(value),
            type,
          },
        ],
      },
    };
    const response = await admin.graphql(mutation, { variables });
    const data = await response.json();
    if (data?.data?.productUpdate?.userErrors?.length) {
      console.error("⚠️ Metafield creation errors:", data.data.productUpdate.userErrors);
      throw new Error(data.data.productUpdate.userErrors.map(e => e.message).join(", "));
    }
    const metafields = data.data.productUpdate.product.metafields.edges.map(edge => edge.node);
    const createdMetafield = metafields.find(mf => mf.key === key && mf.namespace === namespace);
    return createdMetafield;
  } catch (err) {
    console.error("❌ createMetafield error:", err.message || err);
    throw err;
  }
};
