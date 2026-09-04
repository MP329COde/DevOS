CREATE TABLE "item_comments" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "author" VARCHAR(200),
    "propagated_to_gitlab" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "item_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "item_comments_item_id_created_at_idx" ON "item_comments"("item_id", "created_at");
ALTER TABLE "item_comments" ADD CONSTRAINT "item_comments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
