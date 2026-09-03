CREATE TABLE "catalog_entities" (
    "id" UUID NOT NULL,
    "kind" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "source_project" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(50) NOT NULL,
    "lifecycle" VARCHAR(50) NOT NULL,
    "owner" VARCHAR(200) NOT NULL,
    "system" VARCHAR(100),
    "depends_on" TEXT[],
    "provides_apis" TEXT[],
    "annotations" JSONB NOT NULL,
    "links" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_entities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalog_entities_kind_name_key" ON "catalog_entities"("kind", "name");
