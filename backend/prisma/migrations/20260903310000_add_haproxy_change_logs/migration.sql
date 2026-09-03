CREATE TABLE "haproxy_change_logs" (
    "id" UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "backend" VARCHAR(100) NOT NULL,
    "server" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reverted_at" TIMESTAMP(3),

    CONSTRAINT "haproxy_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "haproxy_change_logs_backend_idx" ON "haproxy_change_logs"("backend");
