-- P4 follow-up: org history must survive removing a session's host. Additive/relaxing only.
-- Requires PostgreSQL 15+ (ON DELETE SET NULL with a column list).
-- Rollback (local): delete host-less sessions, re-add NOT NULL and the old CASCADE foreign key.

ALTER TABLE "live_sessions" ALTER COLUMN "host_membership_id" DROP NOT NULL;

ALTER TABLE "live_sessions" DROP CONSTRAINT "live_sessions_organization_id_host_membership_id_fkey";

-- Only host_membership_id is nulled; organization_id stays (it is NOT NULL and part of the tenant key).
ALTER TABLE "live_sessions"
    ADD CONSTRAINT "live_sessions_organization_id_host_membership_id_fkey"
    FOREIGN KEY ("organization_id", "host_membership_id")
    REFERENCES "memberships"("organization_id", "id")
    ON DELETE SET NULL ("host_membership_id") ON UPDATE CASCADE;
