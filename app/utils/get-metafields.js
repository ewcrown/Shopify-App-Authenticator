export const getMetafields = async (admin, product_id) => {
  let gid;
  if (typeof product_id === "string" && product_id.startsWith("gid://")) {
    gid = product_id;
  } else {
    gid = `gid://shopify/Product/${product_id}`;
  }

  const query = `
    query GetProductMetafields($id: ID!) {
      product(id: $id) {
        metafields(first: 100) {
          edges {
            node {
              id
              namespace
              key
              value
              type
            }
          }
        }
      }
    }
  `;
  const variables = { id: gid };
  try {
    const response = await admin.graphql(query, { variables });
    const resp = await response.json();
    const edges = resp.data.product?.metafields?.edges || [];
    // console.log("🧩 Metafields fetched:", edges);
    return edges;
  } catch (err) {
    console.error("⚠️ getMetafields error:", err);
    return [];
  }
};