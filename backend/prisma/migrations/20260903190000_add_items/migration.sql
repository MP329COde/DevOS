-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('task', 'doc', 'goal');

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "type" "ItemType" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'backlog',
    "parent_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "items_type_status_idx" ON "items"("type", "status");
CREATE INDEX "items_parent_id_idx" ON "items"("parent_id");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;