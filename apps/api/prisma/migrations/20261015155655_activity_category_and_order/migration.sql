-- P1: activity category + explicit display order.
-- Expand-and-backfill so the migration is safe on a populated table:
-- add nullable columns, backfill known catalog rows, then enforce NOT NULL.

-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('ICEBREAKER', 'CHECK_IN', 'QUIZ', 'GUESSING', 'CREATIVE');

-- AlterTable (nullable first)
ALTER TABLE "activity_definitions"
  ADD COLUMN "category" "ActivityCategory",
  ADD COLUMN "display_order" INTEGER;

-- Backfill the MVP catalog (seed keeps these values authoritative afterwards)
UPDATE "activity_definitions" SET "category" = 'ICEBREAKER', "display_order" = 10 WHERE "slug" = 'this-or-that';
UPDATE "activity_definitions" SET "category" = 'CHECK_IN',   "display_order" = 20 WHERE "slug" = 'emoji-check-in';
UPDATE "activity_definitions" SET "category" = 'QUIZ',       "display_order" = 30 WHERE "slug" = 'trivia-rush';
UPDATE "activity_definitions" SET "category" = 'GUESSING',   "display_order" = 40 WHERE "slug" = 'who-am-i';
UPDATE "activity_definitions" SET "category" = 'CREATIVE',   "display_order" = 50 WHERE "slug" = 'caption-clash';
UPDATE "activity_definitions" SET "category" = 'CREATIVE',   "display_order" = 60 WHERE "slug" = 'sketch-and-guess';
-- Any unknown rows (none expected) get safe values rather than failing the migration.
UPDATE "activity_definitions" SET "category" = 'ICEBREAKER' WHERE "category" IS NULL;
UPDATE "activity_definitions" SET "display_order" = 1000 WHERE "display_order" IS NULL;

-- Enforce
ALTER TABLE "activity_definitions"
  ALTER COLUMN "category" SET NOT NULL,
  ALTER COLUMN "display_order" SET NOT NULL;

-- CreateIndex
CREATE INDEX "activity_definitions_display_order_idx" ON "activity_definitions"("display_order");
