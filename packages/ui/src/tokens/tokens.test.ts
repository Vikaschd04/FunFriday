import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { palette, semanticColors } from './colors.js';
import { WCAG_AA, contrastRatio } from './contrast.js';

const c = semanticColors;

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
  ];

  it.each(textPairs)('%s >= 4.5:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA.normalText);
  });

  const uiPairs: Array<[string, string, string]> = [
    ['borderStrong on surfaceDefault', c.borderStrong, c.surfaceDefault],
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
