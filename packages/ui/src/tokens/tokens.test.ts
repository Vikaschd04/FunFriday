import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { palette, semanticColors } from './colors.js';
import { WCAG_AA, contrastRatio } from './contrast.js';
import { durations, stagger } from './motion.js';
import { minTapTarget, radii, shadows, zIndex } from './spacing.js';
import { typeScale } from './typography.js';

const c = semanticColors;
const p = palette;

describe('contrastRatio', () => {
  it('matches known reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('rejects malformed colors', () => {
    expect(() => contrastRatio('violet', '#FFFFFF')).toThrow(TypeError);
  });
});

describe('semantic token pairs meet WCAG 2.2 AA', () => {
  const textPairs: Array<[string, string, string]> = [
    ['fgPrimary on bgCanvas', c.fgPrimary, c.bgCanvas],
    ['fgPrimary on surfaceDefault', c.fgPrimary, c.surfaceDefault],
    ['fgMuted on bgCanvas', c.fgMuted, c.bgCanvas],
    ['fgMuted on surfaceDefault', c.fgMuted, c.surfaceDefault],
    ['fgOnBrand on brandPrimary', c.fgOnBrand, c.brandPrimary],
    ['fgOnBrand on brandPrimaryHover', c.fgOnBrand, c.brandPrimaryHover],
    ['fgBrand on surfaceDefault', c.fgBrand, c.surfaceDefault],
    ['fgBrand on surfaceBrandSubtle', c.fgBrand, c.surfaceBrandSubtle],
    ['fgSuccess on surfaceDefault', c.fgSuccess, c.surfaceDefault],
    ['fgDanger on surfaceDefault', c.fgDanger, c.surfaceDefault],
    ['fgSuccess on surfaceSuccessSubtle', c.fgSuccess, c.surfaceSuccessSubtle],
    ['fgDanger on surfaceDangerSubtle', c.fgDanger, c.surfaceDangerSubtle],
    ['fgPrimary on surfaceWarningSubtle', c.fgPrimary, c.surfaceWarningSubtle],
    ['fgPrimary on surfaceBrandSubtle', c.fgPrimary, c.surfaceBrandSubtle],
    ['brandPrimaryHover on bgCanvas', c.brandPrimaryHover, c.bgCanvas],
    ['fgPrimary on accentCoral', c.fgPrimary, c.accentCoral],
    ['fgPrimary on accentMint', c.fgPrimary, c.accentMint],
    ['fgPrimary on accentSun', c.fgPrimary, c.accentSun],
    // P1 spec section 1.1 approved pairs (previously hand-estimated; now computed).
    ['muted on violet50', p.muted, p.violet50],
    ['muted on mint50', p.muted, p.mint50],
    ['muted on sun50', p.muted, p.sun50],
    ['muted on coral50', p.muted, p.coral50],
    ['white on violet800', p.surface, p.violet800],
    ['violet700 on violet50', p.violet700, p.violet50],
    ['violet800 on surface (focus/links)', p.violet800, p.surface],
    ['mint700 on mint50', p.mint700, p.mint50],
    ['mint700 on surface', p.mint700, p.surface],
    ['coral700 on coral50', p.coral700, p.coral50],
    ['coral700 on surface', p.coral700, p.surface],
    ['coral700 on canvas', p.coral700, p.canvas],
    ['white on coral700 (danger button)', p.surface, p.coral700],
    ['white on coral800 (danger hover)', p.surface, p.coral800],
    ['ink on sun50', p.ink, p.sun50],
    ['ink on sun400', p.ink, p.sun400],
    ['ink on mint500', p.ink, p.mint500],
    ['ink on coral500', p.ink, p.coral500],
    ['ink on coral50', p.ink, p.coral50],
    ['ink on mint50', p.ink, p.mint50],
    ['ink on border (skeleton labels)', p.ink, p.border],
    // P4 live UI: choice A / B / Pass, timer, chips, progress.
    ['live: white on violet700 (badge A, bar A)', p.surface, p.violet700],
    ['live: ink on violet50 (choice A text)', p.ink, p.violet50],
    ['live: ink on surface (pass text, timer numeral)', p.ink, p.surface],
    ['live: ink on canvas (question, status line)', p.ink, p.canvas],
    ['live: muted on canvas (shortcut hints)', p.muted, p.canvas],
    ['live: muted on surface (roster, hints)', p.muted, p.surface],
    ['live: white on ink ("Your pick" chip)', p.surface, p.ink],
    ['live: white on mint700 (finished round check)', p.surface, p.mint700],
    ['live: mint700 on mint50 (ready pill, ready toggle)', p.mint700, p.mint50],
    ['semantic fgOnDanger on dangerFill', c.fgOnDanger, c.dangerFill],
    ['semantic fgOnDanger on dangerFillHover', c.fgOnDanger, c.dangerFillHover],
  ];

  it.each(textPairs)('%s >= 4.5:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA.normalText);
  });

  const uiPairs: Array<[string, string, string]> = [
    ['borderStrong on surfaceDefault', c.borderStrong, c.surfaceDefault],
    ['borderStrong on bgCanvas', c.borderStrong, c.bgCanvas],
    ['borderStrong on violet50', c.borderStrong, p.violet50],
    ['focusRing on surfaceDefault', c.focusRing, c.surfaceDefault],
    ['focusRing on bgCanvas', c.focusRing, c.bgCanvas],
    ['focusRing on violet50', c.focusRing, p.violet50],
    ['violet700 selected border on violet50', p.violet700, p.violet50],
    ['live: coral700 border/badge on coral50 (choice B)', p.coral700, p.coral50],
    ['live: borderStrong dashed Pass border on surface', p.borderStrong, p.surface],
    ['live: borderStrong dashed Pass border on canvas', p.borderStrong, p.canvas],
    ['live: violet700 timer bar on border track', p.violet700, p.border],
    ['live: coral700 urgent timer bar on border track', p.coral700, p.border],
    ['live: mint700 ready border on mint50', p.mint700, p.mint50],
    ['live: ink badge on surface (current round segment)', p.ink, p.surface],
    ['coral700 error border on surface', p.coral700, p.surface],
    ['brandAccent on bgCanvas', c.brandAccent, c.bgCanvas],
    ['brandPrimary focus ring on bgCanvas', c.brandPrimary, c.bgCanvas],
  ];

  it.each(uiPairs)('%s >= 3:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA.largeTextOrUi);
  });

  it('documents that raw violet-600 is NOT safe for white body text', () => {
    expect(contrastRatio(palette.surface, palette.violet600)).toBeLessThan(WCAG_AA.normalText);
  });
});

describe('tokens.css stays in sync with colors.ts', () => {
  const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
  const kebab = (name: string) => name.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();

  it.each(Object.entries(palette))('--ff-%s matches', (name, hex) => {
    const variable = `--ff-${kebab(name)}`;
    const match = new RegExp(`${variable}:\\s*(#[0-9a-fA-F]{6});`).exec(css);
    expect(match?.[1]?.toLowerCase(), variable).toBe(hex.toLowerCase());
  });
});

describe('tokens.css non-colour tokens stay in sync with TS modules', () => {
  const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
  const px = (name: string): number => {
    const match = new RegExp(`${name}:\\s*(\\d+)px;`).exec(css);
    return Number(match?.[1]);
  };
  const ms = (name: string): number => {
    const match = new RegExp(`${name}:\\s*(\\d+)ms;`).exec(css);
    return Number(match?.[1]);
  };
  const num = (name: string): number => {
    const match = new RegExp(`${name}:\\s*(\\d+);`).exec(css);
    return Number(match?.[1]);
  };

  it('radii', () => {
    expect(px('--ff-radius-sm')).toBe(radii.sm);
    expect(px('--ff-radius-button')).toBe(radii.button);
    expect(px('--ff-radius-field')).toBe(radii.field);
    expect(px('--ff-radius-card')).toBe(radii.card);
    expect(px('--ff-radius-dialog')).toBe(radii.dialog);
    expect(px('--ff-radius-pill')).toBe(radii.pill);
  });

  it('z-index', () => {
    expect(num('--ff-z-sticky')).toBe(zIndex.sticky);
    expect(num('--ff-z-nav')).toBe(zIndex.nav);
    expect(num('--ff-z-popover')).toBe(zIndex.popover);
    expect(num('--ff-z-scrim')).toBe(zIndex.scrim);
    expect(num('--ff-z-dialog')).toBe(zIndex.dialog);
    expect(num('--ff-z-toast')).toBe(zIndex.toast);
    expect(num('--ff-z-skip')).toBe(zIndex.skipLink);
  });

  it('motion durations', () => {
    expect(ms('--ff-duration-press')).toBe(durations.press);
    expect(ms('--ff-duration-fast')).toBe(durations.fast);
    expect(ms('--ff-duration-enter')).toBe(durations.enter);
    expect(ms('--ff-duration-reveal')).toBe(durations.reveal);
    expect(ms('--ff-duration-meter')).toBe(durations.meter);
    expect(ms('--ff-stagger-step')).toBe(stagger.step);
  });

  it('zeroes travel durations under prefers-reduced-motion', () => {
    const block = /prefers-reduced-motion: reduce\)\s*\{[\s\S]*$/.exec(css)?.[0] ?? '';
    for (const name of ['press', 'enter', 'fast', 'reveal', 'meter']) {
      expect(block).toContain(`--ff-duration-${name}: 0ms;`);
    }
  });

  it.each(Object.entries(shadows))('shadow %s matches', (name, value) => {
    const normalise = (v: string): string =>
      v
        .replace(/rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/g, 'rgba($1,$2,$3,$4)')
        .replace(/\s+/g, '')
        .replace(/,0\./g, ',.')
        .toLowerCase();
    const match = new RegExp(`--ff-shadow-${name}:\\s*([^;]+);`).exec(css);
    expect(match?.[1], name).toBeDefined();
    expect(normalise(match?.[1] ?? '')).toBe(normalise(value));
  });

  it('type scale never drops body below 16px and tap target is 44', () => {
    expect(typeScale.body.mobile.size).toBe(16);
    expect(minTapTarget).toBe(44);
  });
});
