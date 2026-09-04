-- CreateTable
CREATE TABLE "dev_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "technologies" TEXT[],
    "dependencies" JSONB NOT NULL DEFAULT '[]',
    "version" VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    "environments" TEXT[],
    "integrable_tools" TEXT[],
    "generated_items" TEXT[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "previous_version_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dev_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dev_templates_active_idx" ON "dev_templates"("active");
