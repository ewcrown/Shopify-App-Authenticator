/*
  Warnings:

  - You are about to drop the `Image` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Metafield` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `createdAt` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Product` table. All the data in the column will be lost.
  - Added the required column `order_id` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Image_shopifyId_idx";

-- DropIndex
DROP INDEX "Image_productId_idx";

-- DropIndex
DROP INDEX "Metafield_namespace_key_idx";

-- DropIndex
DROP INDEX "Metafield_key_idx";

-- DropIndex
DROP INDEX "Metafield_shopifyId_idx";

-- DropIndex
DROP INDEX "Metafield_productId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Image";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Metafield";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "order_id" TEXT NOT NULL
);
INSERT INTO "new_Product" ("handle", "id", "shopifyId", "title") SELECT "handle", "id", "shopifyId", "title" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_shopifyId_key" ON "Product"("shopifyId");
CREATE UNIQUE INDEX "Product_handle_key" ON "Product"("handle");
CREATE INDEX "Product_shopifyId_idx" ON "Product"("shopifyId");
CREATE INDEX "Product_handle_idx" ON "Product"("handle");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
