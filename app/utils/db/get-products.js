import prisma from '../../db.server';

export async function getPaginatedProducts(page = 1, pageSize = 50) {
  // Ensure page is always at least 1
  const pageNumber = Math.max(page, 1); // Prevent negative or zero page numbers

  // Calculate the number of items to skip based on the current page
  const skip = (pageNumber - 1) * pageSize;

  try {
    const products = await prisma.product.findMany({
      skip: skip,
      take: pageSize,
      orderBy: {
        title: 'asc',
      },
    });

    return products;
  } catch (error) {
    console.error("Error fetching paginated products:", error);
    return [];
  }
}
