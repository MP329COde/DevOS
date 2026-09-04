-- CreateEnum
CREATE TYPE "DevProjectStatus" AS ENUM ('planning', 'development', 'maintenance', 'done', 'archived');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "dev_project_id" UUID;

-- CreateTable
CREATE TABLE "dev_projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "DevProjectStatus" NOT NULL DEFAULT 'planning',
    "owner" VARCHAR(200),
    "members" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "planned_start_at" TIMESTAMP(3),
    "planned_end_at" TIMESTAMP(3),
    "delivery_goal" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dev_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dev_projects_status_idx" ON "dev_projects"("status");

-- CreateIndex
CREATE INDEX "items_dev_project_id_idx" ON "items"("dev_project_id");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_dev_project_id_fkey" FOREIGN KEY ("dev_project_id") REFERENCES "dev_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
