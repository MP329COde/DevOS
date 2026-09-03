CREATE TABLE "cycles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "items" ADD COLUMN "cycle_id" UUID;
CREATE INDEX "cycles_starts_at_ends_at_idx" ON "cycles"("starts_at", "ends_at");
CREATE INDEX "items_cycle_id_idx" ON "items"("cycle_id");
ALTER TABLE "items" ADD CONSTRAINT "items_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;