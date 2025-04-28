export const getMetafields = async (admin, product_id) => {
  const metafieldsResponse = await admin.graphql(`
    query GetProductMetafields($id: ID!) {
      product(id: $id) {
        metafields(first: 100) {
          edges {
            node {
              namespace
              key
              value
              type
            }
          }
        }
      }
    }
  `, {
    variables: {
      id: `gid://shopify/Product/${product_id}`,
    },
  });

  const metafieldsData = await metafieldsResponse.json();
  const metafields = metafieldsData?.data?.product?.metafields?.edges || [];

  console.log('🧩 Metafields fetched:', metafields);

  return metafields;
};
