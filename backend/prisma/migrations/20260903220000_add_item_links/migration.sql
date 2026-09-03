CREATE TYPE "ItemLinkType" AS ENUM ('relates_to', 'blocks', 'is_blocked_by');

CREATE TABLE "item_links" (
    "source_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "type" "ItemLinkType" NOT NULL,
    CONSTRAINT "item_links_pkey" PRIMARY KEY ("source_id", "target_id", "type")
);

CREATE INDEX "item_links_target_id_idx" ON "item_links"("target_id");
ALTER TABLE "item_links" ADD CONSTRAINT "item_links_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_links" ADD CONSTRAINT "item_links_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;