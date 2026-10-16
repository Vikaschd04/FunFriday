-- P4 live sessions (ADR 0003). Additive only: new enum + 3 tables, no changes to existing objects.
-- Rollback (local): DROP TABLE game_results, session_participants, live_sessions; DROP TYPE "LiveSessionStatus";
-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('LOBBY', 'LIVE', 'ENDED');

-- CreateTable
CREATE TABLE "live_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "host_membership_id" UUID NOT NULL,
    "title" VARCHAR(60) NOT NULL,
    "room_code" CHAR(6) NOT NULL,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'LOBBY',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_participants" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "first_joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_results" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "game_slug" VARCHAR(64) NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3) NOT NULL,
    "summary" JSONB NOT NULL,

    CONSTRAINT "game_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "live_sessions_organization_id_status_created_at_idx" ON "live_sessions"("organization_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "live_sessions_organization_id_id_key" ON "live_sessions"("organization_id", "id");

-- CreateIndex
CREATE INDEX "session_participants_organization_id_membership_id_idx" ON "session_participants"("organization_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_session_id_membership_id_key" ON "session_participants"("session_id", "membership_id");

-- CreateIndex
CREATE INDEX "game_results_organization_id_session_id_idx" ON "game_results"("organization_id", "session_id");

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_organization_id_host_membership_id_fkey" FOREIGN KEY ("organization_id", "host_membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_organization_id_session_id_fkey" FOREIGN KEY ("organization_id", "session_id") REFERENCES "live_sessions"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_organization_id_membership_id_fkey" FOREIGN KEY ("organization_id", "membership_id") REFERENCES "memberships"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_organization_id_session_id_fkey" FOREIGN KEY ("organization_id", "session_id") REFERENCES "live_sessions"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written integrity constraints (Prisma cannot express partial indexes or CHECKs).

-- A room code identifies at most ONE session that is still open; ended sessions release it.
-- Also the lookup index for join-by-code.
CREATE UNIQUE INDEX "live_sessions_room_code_open_key" ON "live_sessions"("room_code") WHERE "status" <> 'ENDED';

ALTER TABLE "live_sessions"
    ADD CONSTRAINT "live_sessions_room_code_alphabet_check" CHECK ("room_code" ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
    ADD CONSTRAINT "live_sessions_title_not_blank_check" CHECK (char_length(btrim("title")) >= 2),
    ADD CONSTRAINT "live_sessions_ended_has_time_check" CHECK (("status" = 'ENDED') = ("ended_at" IS NOT NULL));

ALTER TABLE "game_results"
    ADD CONSTRAINT "game_results_summary_object_check" CHECK (jsonb_typeof("summary") = 'object'),
    ADD CONSTRAINT "game_results_time_order_check" CHECK ("ended_at" >= "started_at");
