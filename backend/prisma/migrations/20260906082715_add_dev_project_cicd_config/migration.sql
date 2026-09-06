-- CreateEnum
CREATE TYPE "CiCdProvider" AS ENUM ('gitlab', 'github');

-- CreateTable
CREATE TABLE "dev_project_cicd_configs" (
    "id" UUID NOT NULL,
    "dev_project_id" UUID NOT NULL,
    "provider" "CiCdProvider" NOT NULL,
    "repo_identifier" VARCHAR(300) NOT NULL,
    "vault_secret_name" VARCHAR(150) NOT NULL,
    "argo_app_name" VARCHAR(200),
    "harbor_project" VARCHAR(200),
    "harbor_repo" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dev_project_cicd_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dev_project_cicd_configs_dev_project_id_key" ON "dev_project_cicd_configs"("dev_project_id");

-- AddForeignKey
ALTER TABLE "dev_project_cicd_configs" ADD CONSTRAINT "dev_project_cicd_configs_dev_project_id_fkey" FOREIGN KEY ("dev_project_id") REFERENCES "dev_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
