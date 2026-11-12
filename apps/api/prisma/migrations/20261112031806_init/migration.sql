-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('SUPPLIER', 'BUYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPPLIER_OWNER', 'SUPPLIER_MEMBER', 'BUYER_PROCUREMENT', 'BUYER_CONTRACTS', 'BUYER_FINANCE', 'BUYER_PROJECT', 'BUYER_APPROVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('SSM', 'CIDB', 'PUBLIC_LIABILITY', 'WORKMEN_COMP', 'TAX_CLEARANCE', 'BANK_REFERENCE', 'ISO', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'CONVERTING', 'CLASSIFYING', 'EXTRACTING', 'NEEDS_REVIEW', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "VendorCheckStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'MORE_INFO', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PassportStatus" AS ENUM ('DRAFT', 'VERIFIED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('D60', 'D30', 'D7', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'GRANTED', 'DECLINED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "name" TEXT NOT NULL,
    "registration_no" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "verification_token_hash" TEXT,
    "suspended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "sha256" TEXT NOT NULL,
    "doc_type" "DocType",
    "classification_confidence" DOUBLE PRECISION,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "issued_at" DATE,
    "expires_at" DATE,
    "superseded_by_id" TEXT,
    "duplicate_of_id" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_fields" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "raw_value" TEXT,
    "normalized_value" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "page" INTEGER NOT NULL DEFAULT 1,
    "bbox_x" DOUBLE PRECISION,
    "bbox_y" DOUBLE PRECISION,
    "bbox_width" DOUBLE PRECISION,
    "bbox_height" DOUBLE PRECISION,
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "corrected_value" TEXT,

    CONSTRAINT "document_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_checks" (
    "id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "tender_title" TEXT NOT NULL,
    "contract_value" DECIMAL(16,2) NOT NULL,
    "required_doc_types" "DocType"[],
    "trust_score" INTEGER,
    "status" "VendorCheckStatus" NOT NULL DEFAULT 'DRAFT',
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "vendor_check_id" TEXT,
    "rule" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "message" TEXT NOT NULL,
    "deduction" INTEGER NOT NULL,
    "document_ids" TEXT[],
    "meta" JSONB,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passports" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "trust_score" INTEGER NOT NULL DEFAULT 100,
    "status" "PassportStatus" NOT NULL DEFAULT 'DRAFT',
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passport_shares" (
    "id" TEXT NOT NULL,
    "passport_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "buyer_id" TEXT,
    "label" TEXT,
    "created_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_viewed_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passport_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passport_share_views" (
    "id" TEXT NOT NULL,
    "share_id" TEXT NOT NULL,
    "viewer_user_id" TEXT,
    "viewer_ip" TEXT,
    "user_agent" TEXT,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passport_share_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "message" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "share_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "organization_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "document_id" TEXT,
    "supplier_id" TEXT,
    "operation" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_hash_key" ON "invites"("token_hash");

-- CreateIndex
CREATE INDEX "documents_supplier_id_status_idx" ON "documents"("supplier_id", "status");

-- CreateIndex
CREATE INDEX "documents_supplier_id_doc_type_idx" ON "documents"("supplier_id", "doc_type");

-- CreateIndex
CREATE INDEX "documents_expires_at_idx" ON "documents"("expires_at");

-- CreateIndex
CREATE INDEX "documents_sha256_idx" ON "documents"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "document_fields_document_id_key_key" ON "document_fields"("document_id", "key");

-- CreateIndex
CREATE INDEX "vendor_checks_buyer_id_status_idx" ON "vendor_checks"("buyer_id", "status");

-- CreateIndex
CREATE INDEX "vendor_checks_supplier_id_idx" ON "vendor_checks"("supplier_id");

-- CreateIndex
CREATE INDEX "findings_supplier_id_vendor_check_id_idx" ON "findings"("supplier_id", "vendor_check_id");

-- CreateIndex
CREATE UNIQUE INDEX "passports_supplier_id_key" ON "passports"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "passport_shares_token_hash_key" ON "passport_shares"("token_hash");

-- CreateIndex
CREATE INDEX "passport_shares_passport_id_idx" ON "passport_shares"("passport_id");

-- CreateIndex
CREATE INDEX "passport_share_views_share_id_idx" ON "passport_share_views"("share_id");

-- CreateIndex
CREATE INDEX "access_requests_supplier_id_status_idx" ON "access_requests"("supplier_id", "status");

-- CreateIndex
CREATE INDEX "reminders_due_at_sent_at_idx" ON "reminders"("due_at", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "reminders_document_id_kind_key" ON "reminders"("document_id", "kind");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_fields" ADD CONSTRAINT "document_fields_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_fields" ADD CONSTRAINT "document_fields_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_checks" ADD CONSTRAINT "vendor_checks_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_checks" ADD CONSTRAINT "vendor_checks_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_checks" ADD CONSTRAINT "vendor_checks_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_checks" ADD CONSTRAINT "vendor_checks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_vendor_check_id_fkey" FOREIGN KEY ("vendor_check_id") REFERENCES "vendor_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passports" ADD CONSTRAINT "passports_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_shares" ADD CONSTRAINT "passport_shares_passport_id_fkey" FOREIGN KEY ("passport_id") REFERENCES "passports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_shares" ADD CONSTRAINT "passport_shares_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_shares" ADD CONSTRAINT "passport_shares_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_share_views" ADD CONSTRAINT "passport_share_views_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "passport_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passport_share_views" ADD CONSTRAINT "passport_share_views_viewer_user_id_fkey" FOREIGN KEY ("viewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "passport_shares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
