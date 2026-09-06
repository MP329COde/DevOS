-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "resource_kind" VARCHAR(30),
ADD COLUMN "resource_id" VARCHAR(120),
ADD COLUMN "priority" VARCHAR(20) NOT NULL DEFAULT 'normal';
