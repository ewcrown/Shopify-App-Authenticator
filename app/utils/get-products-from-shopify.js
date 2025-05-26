/**
 * Fetch one “page” of products via the Shopify Admin GraphQL client
 *
 * @param {object} admin          – the Shopify admin object with `.graphql`
 * @param {string|null} cursor    – the GraphQL `after` cursor
 * @param {number} pageSize       – how many products to fetch
 */
export async function getPaginatedProductsFromShopify(
  admin,
  cursor = null,
  pageSize = 50
) {
  const query = `
    query GetProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            handle
            category {
              id
              name
              fullName
            }
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

  // Make absolutely sure it's a number
  const variables = {
    first: Number(pageSize),
    after: cursor,
  };

  try {
    // admin.graphql is your ready-to-use client
    const response = await admin.graphql(query, { variables });
    const resp = await response.json()

    const product_object = await resp.data.products

    const {
      edges,
      pageInfo: { hasNextPage, endCursor },
    } = product_object

    console.log('node==>', edges)

    const products = edges.map(({ node }) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      images: node.images.edges.map((e) => ({
        src: e.node.originalSrc,
        alt: e.node.altText,
      })),
      category: node.category,
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
