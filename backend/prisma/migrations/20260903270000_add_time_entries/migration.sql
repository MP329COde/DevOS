CREATE TABLE "time_entries" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "time_entries_item_id_started_at_idx" ON "time_entries"("item_id", "started_at");
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;