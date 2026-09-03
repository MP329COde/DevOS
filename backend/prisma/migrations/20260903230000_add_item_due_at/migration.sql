ALTER TABLE "items" ADD COLUMN "due_at" TIMESTAMP(3);
CREATE INDEX "items_due_at_idx" ON "items"("due_at");