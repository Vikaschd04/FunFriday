/** Typography scale (docs/design/P1_SCREENS.md 1.2). Sizes in px; line heights in px. */
export const fontFamilies = {
  heading: '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  body: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

export interface TextStyle {
  readonly size: number;
  readonly line: number;
}
export interface TypeStyle {
  readonly desktop: TextStyle;
  readonly mobile: TextStyle;
  readonly weight: number;
  readonly family: keyof typeof fontFamilies;
  /** CSS letter-spacing. */
  readonly tracking: string;
}

export const typeScale = {
  display: {
    desktop: { size: 64, line: 68 },
    mobile: { size: 40, line: 44 },
    weight: 800,
    family: 'heading',
    tracking: '-0.03em',
  },
  h1: {
    desktop: { size: 40, line: 46 },
    mobile: { size: 30, line: 36 },
    weight: 800,
    family: 'heading',
    tracking: '-0.02em',
  },
  h2: {
    desktop: { size: 30, line: 38 },
    mobile: { size: 24, line: 32 },
    weight: 700,
    family: 'heading',
    tracking: '-0.015em',
  },
  h3: {
    desktop: { size: 22, line: 30 },
    mobile: { size: 20, line: 28 },
    weight: 700,
    family: 'heading',
    tracking: '-0.01em',
  },
  h4: {
    desktop: { size: 18, line: 26 },
    mobile: { size: 18, line: 26 },
    weight: 700,
    family: 'heading',
    tracking: '0',
  },
  bodyLg: {
    desktop: { size: 20, line: 32 },
    mobile: { size: 18, line: 28 },
    weight: 400,
    family: 'body',
    tracking: '0',
  },
  body: {
    desktop: { size: 16, line: 26 },
    mobile: { size: 16, line: 26 },
    weight: 400,
    family: 'body',
    tracking: '0',
  },
  small: {
    desktop: { size: 14, line: 22 },
    mobile: { size: 14, line: 22 },
    weight: 400,
    family: 'body',
    tracking: '0',
  },
  caption: {
    desktop: { size: 12, line: 16 },
    mobile: { size: 12, line: 16 },
    weight: 600,
    family: 'body',
    tracking: '0.04em',
  },
} as const satisfies Record<string, TypeStyle>;

export type TypeStyleName = keyof typeof typeScale;
