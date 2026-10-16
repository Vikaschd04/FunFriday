-- D026: one-time invitation tokens (hash only). Additive; supersedes claim-by-verified-email.
-- Existing INVITED rows (pre-D026) get no token and can no longer be accepted; re-invite them.
-- Rollback (local): drop the three columns, the index and the constraints below.

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "invite_expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "invite_token_hash" VARCHAR(64),
ADD COLUMN     "invited_by_user_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "memberships_invite_token_hash_key" ON "memberships"("invite_token_hash");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An accepted (ACTIVE) membership never keeps a usable token; token and expiry travel together;
-- the stored value is a SHA-256 hex digest, never a raw token.
ALTER TABLE "memberships"
    ADD CONSTRAINT "memberships_active_has_no_token_check"
        CHECK ("status" <> 'ACTIVE' OR ("invite_token_hash" IS NULL AND "invite_expires_at" IS NULL)),
    ADD CONSTRAINT "memberships_token_expiry_pair_check"
        CHECK (("invite_token_hash" IS NULL) = ("invite_expires_at" IS NULL)),
    ADD CONSTRAINT "memberships_token_hash_format_check"
        CHECK ("invite_token_hash" IS NULL OR "invite_token_hash" ~ '^[0-9a-f]{64}$');
