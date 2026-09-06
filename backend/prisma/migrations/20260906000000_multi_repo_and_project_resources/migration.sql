-- DropIndex
DROP INDEX "dev_project_cicd_configs_dev_project_id_key";

-- AlterTable
ALTER TABLE "catalog_entities" ADD COLUMN     "dev_project_id" UUID;

-- AlterTable
ALTER TABLE "dev_project_cicd_configs" ADD COLUMN     "default_branch" VARCHAR(100),
ADD COLUMN     "name" VARCHAR(200),
ADD COLUMN     "role" VARCHAR(50) NOT NULL DEFAULT 'autre',
ADD COLUMN     "web_url" VARCHAR(500);

-- CreateTable
CREATE TABLE "project_resources" (
    "id" UUID NOT NULL,
    "dev_project_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "host" VARCHAR(300),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_resources_dev_project_id_idx" ON "project_resources"("dev_project_id");

-- CreateIndex
CREATE INDEX "catalog_entities_dev_project_id_idx" ON "catalog_entities"("dev_project_id");

-- CreateIndex
CREATE INDEX "dev_project_cicd_configs_dev_project_id_idx" ON "dev_project_cicd_configs"("dev_project_id");

-- CreateIndex
CREATE UNIQUE INDEX "dev_project_cicd_configs_dev_project_id_provider_repo_ident_key" ON "dev_project_cicd_configs"("dev_project_id", "provider", "repo_identifier");

-- AddForeignKey
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_dev_project_id_fkey" FOREIGN KEY ("dev_project_id") REFERENCES "dev_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_entities" ADD CONSTRAINT "catalog_entities_dev_project_id_fkey" FOREIGN KEY ("dev_project_id") REFERENCES "dev_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Le défaut n'est utile que pour les lignes existantes lors de cette migration (voir ci-dessus) ;
-- les nouvelles écritures passent toujours par un rôle explicite (voir repository-service.ts).
ALTER TABLE "dev_project_cicd_configs" ALTER COLUMN "role" DROP DEFAULT;
