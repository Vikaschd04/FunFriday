import type { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * The six MVP activities (docs/GAMES.md). Limits are design targets until load
 * tests confirm them; every entry stays PLANNED until its phase ships it.
 */
export const activityCatalog = [
  {
    slug: 'this-or-that',
    category: 'ICEBREAKER',
    displayOrder: 10,
    name: 'This or That',
    summary: 'Quick two-option polls that reveal what the group has in common.',
    minPlayers: 2,
    maxPlayers: 200,
    estimatedMinutesMin: 3,
    estimatedMinutesMax: 8,
  },
  {
    slug: 'emoji-check-in',
    category: 'CHECK_IN',
    displayOrder: 20,
    name: 'Emoji Check-In',
    summary: 'Pick the vibe you are bringing today; results are shown only as a group.',
    minPlayers: 2,
    maxPlayers: 200,
    estimatedMinutesMin: 2,
    estimatedMinutesMax: 5,
  },
  {
    slug: 'trivia-rush',
    category: 'QUIZ',
    displayOrder: 30,
    name: 'Trivia Rush',
    summary: 'Fast, friendly trivia for individuals or teams with server-verified answers.',
    minPlayers: 2,
    maxPlayers: 200,
    estimatedMinutesMin: 8,
    estimatedMinutesMax: 15,
  },
  {
    slug: 'who-am-i',
    category: 'GUESSING',
    displayOrder: 40,
    name: 'Who Am I?',
    summary: 'Guess colleagues from fun facts they chose to share; opt-in only.',
    minPlayers: 4,
    maxPlayers: 30,
    estimatedMinutesMin: 7,
    estimatedMinutesMax: 12,
  },
  {
    slug: 'caption-clash',
    category: 'CREATIVE',
    displayOrder: 50,
    name: 'Caption Clash',
    summary: 'Write captions for a shared image and vote anonymously for favourites.',
    minPlayers: 4,
    maxPlayers: 100,
    estimatedMinutesMin: 6,
    estimatedMinutesMax: 12,
  },
  {
    slug: 'sketch-and-guess',
    category: 'CREATIVE',
    displayOrder: 60,
    name: 'Sketch & Guess',
    summary: 'Draw and guess in small rooms; larger groups split into breakouts.',
    minPlayers: 3,
    maxPlayers: 12,
    estimatedMinutesMin: 8,
    estimatedMinutesMax: 20,
  },
] as const;

export const CATALOG_MANIFEST_VERSION = '0.1.0';

/** Idempotent: safe to run on every deploy; updates by slug, never duplicates. */
export async function seedActivityCatalog(prisma: PrismaClient): Promise<number> {
  for (const activity of activityCatalog) {
    const data = { ...activity, manifestVersion: CATALOG_MANIFEST_VERSION };
    await prisma.activityDefinition.upsert({
      where: { slug: activity.slug },
      create: data,
      update: data,
    });
  }
  return activityCatalog.length;
}
