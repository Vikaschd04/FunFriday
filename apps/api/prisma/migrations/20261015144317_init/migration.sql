-- CreateEnum
CREATE TYPE "ActivityAvailability" AS ENUM ('PLANNED', 'ENABLED', 'DISABLED');

-- CreateTable
CREATE TABLE "activity_definitions" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "summary" VARCHAR(280) NOT NULL,
    "manifest_version" VARCHAR(32) NOT NULL,
    "min_players" INTEGER NOT NULL,
    "max_players" INTEGER NOT NULL,
    "estimated_minutes_min" INTEGER NOT NULL,
    "estimated_minutes_max" INTEGER NOT NULL,
    "availability" "ActivityAvailability" NOT NULL DEFAULT 'PLANNED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "activity_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_definitions_slug_key" ON "activity_definitions"("slug");

-- Hand-written integrity rules (not expressible in schema.prisma).
ALTER TABLE "activity_definitions"
  ADD CONSTRAINT "activity_definitions_players_check"
    CHECK ("min_players" >= 1 AND "min_players" <= "max_players"),
  ADD CONSTRAINT "activity_definitions_minutes_check"
    CHECK ("estimated_minutes_min" >= 1 AND "estimated_minutes_min" <= "estimated_minutes_max"),
  ADD CONSTRAINT "activity_definitions_slug_format_check"
    CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
