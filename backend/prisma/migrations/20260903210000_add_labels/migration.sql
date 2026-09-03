CREATE TABLE "labels" (
    "id" UUID NOT NULL,
    "prefix" VARCHAR(50) NOT NULL,
    "value" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "labels_prefix_value_key" ON "labels"("prefix", "value");

CREATE TABLE "item_labels" (
    "item_id" UUID NOT NULL,
    "label_id" UUID NOT NULL,
    CONSTRAINT "item_labels_pkey" PRIMARY KEY ("item_id", "label_id")
);

ALTER TABLE "item_labels" ADD CONSTRAINT "item_labels_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_labels" ADD CONSTRAINT "item_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;