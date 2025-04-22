/*
  Warnings:

  - A unique constraint covering the columns `[handle]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Image_productId_idx" ON "Image"("productId");

-- CreateIndex
CREATE INDEX "Image_shopifyId_idx" ON "Image"("shopifyId");

-- CreateIndex
CREATE INDEX "Metafield_productId_idx" ON "Metafield"("productId");

-- CreateIndex
CREATE INDEX "Metafield_shopifyId_idx" ON "Metafield"("shopifyId");

-- CreateIndex
CREATE INDEX "Metafield_key_idx" ON "Metafield"("key");

-- CreateIndex
CREATE INDEX "Metafield_namespace_key_idx" ON "Metafield"("namespace", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Product_handle_key" ON "Product"("handle");

-- CreateIndex
CREATE INDEX "Product_shopifyId_idx" ON "Product"("shopifyId");

-- CreateIndex
CREATE INDEX "Product_handle_idx" ON "Product"("handle");
