/*
  Warnings:

  - You are about to drop the `bugs` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "ItemType" ADD VALUE 'bug';

-- DropForeignKey
ALTER TABLE "bugs" DROP CONSTRAINT "bugs_dev_project_id_fkey";

-- DropForeignKey
ALTER TABLE "bugs" DROP CONSTRAINT "bugs_item_id_fkey";

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "commit_ref" VARCHAR(200),
ADD COLUMN     "environment" VARCHAR(100),
ADD COLUMN     "expected_behavior" TEXT,
ADD COLUMN     "logs" TEXT,
ADD COLUMN     "observed_behavior" TEXT,
ADD COLUMN     "release_ref" VARCHAR(200),
ADD COLUMN     "repro_steps" TEXT,
ADD COLUMN     "screenshots" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "severity" "BugSeverity",
ADD COLUMN     "version_affected" VARCHAR(100);

-- DropTable
DROP TABLE "bugs";
