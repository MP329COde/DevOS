-- CreateEnum
CREATE TYPE "DocPageType" AS ENUM ('scanned', 'onboarding');

-- AlterTable
ALTER TABLE "doc_pages" ADD COLUMN     "page_type" "DocPageType" NOT NULL DEFAULT 'scanned';
