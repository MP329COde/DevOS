ALTER TABLE "items" ADD COLUMN "content" TEXT;

CREATE TABLE "doc_pages" (
    "id" UUID NOT NULL,
    "source_project" VARCHAR(200) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_pages_source_project_path_key" ON "doc_pages"("source_project", "path");

CREATE TABLE "doc_links" (
    "id" UUID NOT NULL,
    "doc_page_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doc_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_links_doc_page_id_item_id_key" ON "doc_links"("doc_page_id", "item_id");

ALTER TABLE "doc_links" ADD CONSTRAINT "doc_links_doc_page_id_fkey" FOREIGN KEY ("doc_page_id") REFERENCES "doc_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_links" ADD CONSTRAINT "doc_links_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
