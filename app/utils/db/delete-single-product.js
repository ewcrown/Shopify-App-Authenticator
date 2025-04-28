import prisma from '../../db.server'

export const deleteSingleProduct = async (admin, id) => {
  try {
    const deletedProduct = await prisma.product.delete({
      where: {
        shopifyId: id, // Delete the product based on the shopifyId
      },
    });

    console.log(`Product with shopifyId ${id} deleted successfully.`);
    return deletedProduct;
  } catch (error) {
    console.error(`Error deleting product with shopifyId ${id}:`, error);
    throw new Error(`Failed to delete product: ${error.message}`);
  }
};
