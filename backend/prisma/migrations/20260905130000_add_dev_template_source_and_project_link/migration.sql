-- AlterTable
ALTER TABLE "dev_templates"
  ADD COLUMN     "source" VARCHAR(20) NOT NULL DEFAULT 'custom',
  ADD COLUMN     "registry" VARCHAR(20),
  ADD COLUMN     "package_name" VARCHAR(300),
  ADD COLUMN     "repository_url" VARCHAR(500);

-- AlterTable
ALTER TABLE "dev_projects" ADD COLUMN     "template_id" UUID;

-- CreateIndex
CREATE INDEX "dev_templates_source_type_idx" ON "dev_templates"("source", "type");

-- CreateIndex
CREATE INDEX "dev_projects_template_id_idx" ON "dev_projects"("template_id");

-- AddForeignKey
ALTER TABLE "dev_projects" ADD CONSTRAINT "dev_projects_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "dev_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
