-- CreateTable
CREATE TABLE "vendor_ratings" (
    "id" TEXT NOT NULL,
    "vendor_check_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "rated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_ratings_vendor_check_id_key" ON "vendor_ratings"("vendor_check_id");

-- CreateIndex
CREATE INDEX "vendor_ratings_supplier_id_idx" ON "vendor_ratings"("supplier_id");

-- AddForeignKey
ALTER TABLE "vendor_ratings" ADD CONSTRAINT "vendor_ratings_vendor_check_id_fkey" FOREIGN KEY ("vendor_check_id") REFERENCES "vendor_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ratings" ADD CONSTRAINT "vendor_ratings_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ratings" ADD CONSTRAINT "vendor_ratings_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ratings" ADD CONSTRAINT "vendor_ratings_rated_by_fkey" FOREIGN KEY ("rated_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
