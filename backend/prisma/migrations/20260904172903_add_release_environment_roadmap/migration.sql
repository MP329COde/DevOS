-- CreateEnum
CREATE TYPE "ReleaseState" AS ENUM ('draft', 'in_progress', 'released', 'deprecated');

-- CreateEnum
CREATE TYPE "EnvironmentKind" AS ENUM ('dev', 'staging', 'prod', 'other');

-- CreateEnum
CREATE TYPE "EnvironmentStatus" AS ENUM ('unknown', 'up', 'down', 'degraded');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "release_id" UUID;

-- CreateTable
CREATE TABLE "releases" (
    "id" UUID NOT NULL,
    "dev_project_id" UUID NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200),
    "description" TEXT,
    "state" "ReleaseState" NOT NULL DEFAULT 'draft',
    "planned_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "changelog" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environments" (
    "id" UUID NOT NULL,
    "dev_project_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "kind" "EnvironmentKind" NOT NULL DEFAULT 'other',
    "url" VARCHAR(500),
    "status" "EnvironmentStatus" NOT NULL DEFAULT 'unknown',
    "current_version" VARCHAR(50),
    "expected_version" VARCHAR(50),
    "pipeline_status" VARCHAR(30),
    "last_deployed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "environments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "releases_dev_project_id_state_idx" ON "releases"("dev_project_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "releases_dev_project_id_version_key" ON "releases"("dev_project_id", "version");

-- CreateIndex
CREATE INDEX "environments_dev_project_id_kind_idx" ON "environments"("dev_project_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "environments_dev_project_id_name_key" ON "environments"("dev_project_id", "name");

-- CreateIndex
CREATE INDEX "items_release_id_idx" ON "items"("release_id");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_dev_project_id_fkey" FOREIGN KEY ("dev_project_id") REFERENCES "dev_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environments" ADD CONSTRAINT "environments_dev_project_id_fkey" FOREIGN KEY ("dev_project_id") REFERENCES "dev_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
