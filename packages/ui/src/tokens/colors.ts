/**
 * FunFriday color tokens (P0 baseline; P1 expands the full design system).
 *
 * Source palette: docs/DESIGN_SYSTEM.md. Contrast-driven adjustments (verified by
 * tokens.test.ts, WCAG 2.2 relative-luminance formula):
 *  - violet-600 #7765EF on white is 4.29:1 (fails AA body text), so it is a
 *    decorative/brand accent only. Action fills use violet-700 (5.90:1 vs white).
 *  - coral-500 on white is 2.70:1 and mint-500 is lower; both are fills/accents
 *    paired with ink text. Text variants use the -700 shades.
 *  - borderStrong was #8A93A6 (2.96:1 on canvas); #7F889B gives 3.40:1 on canvas,
 *    3.56:1 on surface and >= 3:1 on violet50, so controls may sit on any of them.
 *  - muted text uses #5B6478 (5.67:1 on canvas) instead of #64748B (4.55:1) to
 *    keep headroom when surfaces are tinted.
 */
export const palette = {
  ink: '#202949',
  violet50: '#EEEBFE',
  violet600: '#7765EF',
  violet700: '#5F4BDF',
  violet800: '#4A37C4',
  coral50: '#FFF0EE',
  coral500: '#FF7067',
  coral700: '#B4372F',
  coral800: '#962A23',
  mint50: '#ECFAF7',
  mint500: '#35C8B2',
  mint700: '#0E7A6B',
  sun50: '#FFF6DC',
  sun400: '#FFD166',
  canvas: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E5E9F2',
  borderStrong: '#7F889B',
  muted: '#5B6478',
} as const;

export const semanticColors = {
  bgCanvas: palette.canvas,
  surfaceDefault: palette.surface,
  surfaceBrandSubtle: palette.violet50,
  surfaceSuccessSubtle: palette.mint50,
  surfaceDangerSubtle: palette.coral50,
  surfaceWarningSubtle: palette.sun50,
  fgPrimary: palette.ink,
  fgMuted: palette.muted,
  fgOnBrand: palette.surface,
  fgBrand: palette.violet700,
  fgSuccess: palette.mint700,
  fgDanger: palette.coral700,
  brandAccent: palette.violet600,
  brandPrimary: palette.violet700,
  brandPrimaryHover: palette.violet800,
  brandPrimaryPressed: palette.violet800,
  focusRing: palette.violet800,
  focusRingOffset: palette.surface,
  surfaceNavActive: palette.violet50,
  fgOnDanger: palette.surface,
  dangerFill: palette.coral700,
  dangerFillHover: palette.coral800,
  accentCoral: palette.coral500,
  accentMint: palette.mint500,
  accentSun: palette.sun400,
  borderSubtle: palette.border,
  borderStrong: palette.borderStrong,
} as const;

export type SemanticColor = keyof typeof semanticColors;
