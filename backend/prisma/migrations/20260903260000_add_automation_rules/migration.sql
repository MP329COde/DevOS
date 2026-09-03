CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" VARCHAR(80) NOT NULL,
    "condition" JSONB,
    "action" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "automation_rules_enabled_trigger_idx" ON "automation_rules"("enabled", "trigger");