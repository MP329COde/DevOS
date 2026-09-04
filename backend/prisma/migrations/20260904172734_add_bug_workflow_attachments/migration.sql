-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateTable
CREATE TABLE "item_attachments" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "file_name" VARCHAR(300) NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" VARCHAR(120),
    "size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_code_references" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "ref_type" VARCHAR(20) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_code_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_statuses" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(100),
    "key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20),
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bugs" (
    "id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "severity" "BugSeverity" NOT NULL DEFAULT 'medium',
    "status" VARCHAR(50) NOT NULL DEFAULT 'open',
    "environment" VARCHAR(100),
    "version_affected" VARCHAR(100),
    "expected_behavior" TEXT,
    "observed_behavior" TEXT,
    "repro_steps" TEXT,
    "logs" TEXT,
    "screenshots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "release_ref" VARCHAR(200),
    "commit_ref" VARCHAR(200),
    "item_id" UUID,
    "dev_project_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bugs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_attachments_item_id_idx" ON "item_attachments"("item_id");

-- CreateIndex
CREATE INDEX "item_code_references_item_id_ref_type_idx" ON "item_code_references"("item_id", "ref_type");

-- CreateIndex
CREATE INDEX "workflow_statuses_scope_order_idx" ON "workflow_statuses"("scope", "order");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_statuses_scope_key_key" ON "workflow_statuses"("scope", "key");

-- CreateIndex
CREATE INDEX "bugs_status_idx" ON "bugs"("status");

-- CreateIndex
CREATE INDEX "bugs_severity_idx" ON "bugs"("severity");

-- CreateIndex
CREATE INDEX "bugs_item_id_idx" ON "bugs"("item_id");

-- CreateIndex
CREATE INDEX "bugs_dev_project_id_idx" ON "bugs"("dev_project_id");

-- AddForeignKey
ALTER TABLE "item_attachments" ADD CONSTRAINT "item_attachments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_code_references" ADD CONSTRAINT "item_code_references_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_dev_project_id_fkey" FOREIGN KEY ("dev_project_id") REFERENCES "dev_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
