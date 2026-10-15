/** Motion tokens (docs/design/P1_SCREENS.md 1.5). Durations in ms. Reduced motion zeroes them in CSS. */
export const durations = {
  press: 120,
  fast: 160,
  enter: 200,
  reveal: 360,
  meter: 400,
  shimmer: 1400,
  toast: 5000,
} as const;

export const easings = {
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

/** Stagger step in ms; stagger is applied to at most `maxStaggered` items. */
export const stagger = { step: 60, maxStaggered: 8 } as const;
