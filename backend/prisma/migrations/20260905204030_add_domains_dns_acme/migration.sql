-- CreateEnum
CREATE TYPE "DnsProviderKind" AS ENUM ('duckdns', 'cloudflare', 'ovh', 'manual');

-- CreateEnum
CREATE TYPE "DomainState" AS ENUM ('active', 'pending', 'error', 'expired', 'disabled');

-- CreateEnum
CREATE TYPE "CertificateState" AS ENUM ('none', 'pending', 'valid', 'expiring', 'expired', 'error');

-- CreateTable
CREATE TABLE "dns_provider_accounts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "kind" "DnsProviderKind" NOT NULL,
    "vault_secret_name" VARCHAR(200) NOT NULL,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dns_provider_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acme_accounts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "directory_url" VARCHAR(300) NOT NULL,
    "contact_email" VARCHAR(200) NOT NULL,
    "vault_secret_name" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acme_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "target" VARCHAR(255),
    "state" "DomainState" NOT NULL DEFAULT 'pending',
    "dns_provider_id" UUID,
    "haproxy_frontend" VARCHAR(100),
    "site_item_id" UUID,
    "last_checked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "domain_id" UUID NOT NULL,
    "acme_account_id" UUID NOT NULL,
    "state" "CertificateState" NOT NULL DEFAULT 'none',
    "vault_secret_name" VARCHAR(200) NOT NULL,
    "haproxy_storage_name" VARCHAR(150),
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dns_provider_accounts_kind_name_key" ON "dns_provider_accounts"("kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "acme_accounts_name_key" ON "acme_accounts"("name");

-- CreateIndex
CREATE INDEX "domains_dns_provider_id_idx" ON "domains"("dns_provider_id");

-- CreateIndex
CREATE INDEX "domains_site_item_id_idx" ON "domains"("site_item_id");

-- CreateIndex
CREATE INDEX "domains_state_idx" ON "domains"("state");

-- CreateIndex
CREATE UNIQUE INDEX "domains_name_key" ON "domains"("name");

-- CreateIndex
CREATE INDEX "certificates_domain_id_idx" ON "certificates"("domain_id");

-- CreateIndex
CREATE INDEX "certificates_acme_account_id_idx" ON "certificates"("acme_account_id");

-- CreateIndex
CREATE INDEX "certificates_expires_at_idx" ON "certificates"("expires_at");

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_dns_provider_id_fkey" FOREIGN KEY ("dns_provider_id") REFERENCES "dns_provider_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_site_item_id_fkey" FOREIGN KEY ("site_item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_acme_account_id_fkey" FOREIGN KEY ("acme_account_id") REFERENCES "acme_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
