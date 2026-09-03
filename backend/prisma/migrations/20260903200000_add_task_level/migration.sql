-- CreateEnum
CREATE TYPE "TaskLevel" AS ENUM ('epic', 'story', 'task');

-- AlterTable
ALTER TABLE "items" ADD COLUMN "task_level" "TaskLevel";