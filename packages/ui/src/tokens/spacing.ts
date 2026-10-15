/** Spacing, radii, elevation, z-index and breakpoints (docs/design/P1_SCREENS.md 1.3). */
export const space = {
  '0.5': 4,
  '1': 8,
  '1.5': 12,
  '2': 16,
  '3': 24,
  '4': 32,
  '5': 40,
  '6': 48,
  '8': 64,
  '10': 80,
  '12': 96,
} as const;

export const pageGutter = { mobile: 16, tablet: 24, desktop: 32 } as const;
export const contentMaxWidth = 1152;
export const minTapTarget = 44;

export const radii = {
  sm: 8,
  button: 12,
  field: 12,
  card: 20,
  dialog: 20,
  pill: 9999,
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(32,41,73,.06), 0 0 0 1px #E5E9F2',
  md: '0 8px 20px -6px rgba(32,41,73,.14)',
  lg: '0 20px 44px -14px rgba(32,41,73,.22)',
} as const;

export const zIndex = {
  base: 0,
  sticky: 10,
  nav: 20,
  popover: 30,
  scrim: 40,
  dialog: 50,
  toast: 60,
  skipLink: 100,
} as const;

export const breakpoints = { sm: 480, md: 768, lg: 1024 } as const;
