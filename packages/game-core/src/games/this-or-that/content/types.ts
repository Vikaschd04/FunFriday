/** A single either/or prompt. Original, inclusive content only (docs/CONTENT_POLICY.md). */
export interface ThisOrThatPrompt {
  /** Stable id, `tot-<pack>-NNN`, never reused for different text. */
  id: string;
  /** Short question, max 80 characters, e.g. "Sunrise or sunset?". */
  question: string;
  /** Option labels, max 32 characters each, distinct from each other. */
  optionA: string;
  optionB: string;
  theme: ThisOrThatTheme;
}

export const thisOrThatThemes = [
  'food-and-drink',
  'work-style',
  'travel',
  'leisure',
  'imagination',
  'everyday',
] as const;
export type ThisOrThatTheme = (typeof thisOrThatThemes)[number];

export interface ThisOrThatPack {
  id: string;
  name: string;
  /** Semver; bump when prompts change so results stay traceable. */
  version: string;
  locale: 'en';
  prompts: readonly ThisOrThatPrompt[];
}
