CREATE TYPE "TriageStatus" AS ENUM ('none', 'pending', 'accepted', 'rejected');
ALTER TABLE "items" ADD COLUMN "triage" "TriageStatus" NOT NULL DEFAULT 'none';
CREATE INDEX "items_triage_idx" ON "items"("triage");