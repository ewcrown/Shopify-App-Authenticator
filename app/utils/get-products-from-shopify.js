export async function getPaginatedProductsFromShopify(
  admin,
  cursor = null,
  pageSize = 50
) {
  const query = `
    query GetProducts($first: Int!, $after: String, $query: String) {
      products(
        first: $first,
        after: $after,
        query: $query,
        sortKey: CREATED_AT,
        reverse: true
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            handle
            images(first: 10) {
              edges {
                node {
                  originalSrc
                  altText
                }
              }
            }
            metafields(first: 10, namespace: "custom") {
              edges {
                node {
                  key
                  value
                }
              }
            }
          }
        }
      }
    }
  `;

  const variables = {
    first: Number(pageSize),
    after: cursor,
    query: "status:active"
  };

  try {
    // admin.graphql is your ready-to-use client
    const response = await admin.graphql(query, { variables });
    const resp = await response.json();

    const product_object = resp.data.products;
    const {
      edges,
      pageInfo: { hasNextPage, endCursor },
    } = product_object;
    console.log("edges==>",edges)

    const products = edges.map(({ node }) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      images: node.images.edges.map((e) => ({
        src: e.node.originalSrc,
        alt: e.node.altText,
      })),
      metafields: node.metafields.edges.map((e) => ({
        key: e.node.key,
        value: e.node.value,
      })),
    }));

    return {
      products,
      nextCursor: hasNextPage ? endCursor : null,
    };
  } catch (error) {
    console.error("GraphQL product fetch failed:", error);
    return { products: [], nextCursor: null };
  }
}
