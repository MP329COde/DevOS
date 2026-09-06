-- CreateTable
CREATE TABLE "timeline_events" (
    "id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20),
    "summary" VARCHAR(500) NOT NULL,
    "actor_email" VARCHAR(320),
    "actor_name" VARCHAR(200),
    "dev_project_id" UUID,
    "item_id" UUID,
    "release_id" UUID,
    "environment_id" UUID,
    "commit_ref" VARCHAR(200),
    "pipeline_ref" VARCHAR(200),
    "version" VARCHAR(50),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timeline_events_dev_project_id_created_at_idx" ON "timeline_events"("dev_project_id", "created_at");

-- CreateIndex
CREATE INDEX "timeline_events_item_id_idx" ON "timeline_events"("item_id");

-- CreateIndex
CREATE INDEX "timeline_events_release_id_idx" ON "timeline_events"("release_id");

-- CreateIndex
CREATE INDEX "timeline_events_environment_id_idx" ON "timeline_events"("environment_id");

-- CreateIndex
CREATE INDEX "timeline_events_type_created_at_idx" ON "timeline_events"("type", "created_at");

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_dev_project_id_fkey" FOREIGN KEY ("dev_project_id") REFERENCES "dev_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
