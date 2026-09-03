CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "decision" VARCHAR(20) NOT NULL,
    "local_updated_at" TIMESTAMP(3) NOT NULL,
    "remote_updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
