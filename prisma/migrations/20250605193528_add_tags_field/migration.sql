-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "error_handle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Product" ("createdAt", "error_handle", "handle", "id", "order_id", "shopifyId", "title") SELECT "createdAt", "error_handle", "handle", "id", "order_id", "shopifyId", "title" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_shopifyId_key" ON "Product"("shopifyId");
CREATE UNIQUE INDEX "Product_handle_key" ON "Product"("handle");
CREATE INDEX "Product_shopifyId_idx" ON "Product"("shopifyId");
CREATE INDEX "Product_handle_idx" ON "Product"("handle");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
