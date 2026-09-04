-- AlterEnum
ALTER TYPE "ItemType" ADD VALUE 'note';

-- DropIndex
DROP INDEX "items_due_at_idx";

-- DropIndex
DROP INDEX "items_triage_idx";
