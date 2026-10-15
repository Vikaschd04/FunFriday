/** WCAG 2.x relative luminance of a #RRGGBB color. */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) {
    throw new TypeError(`expected #RRGGBB, received ${hex}`);
  }
  const value = match[1];
  const channel = (offset: number): number => {
    const srgb = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** WCAG contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

export const WCAG_AA = {
  /** Body text below 18pt / 14pt bold. */
  normalText: 4.5,
  /** Large text and meaningful non-text UI (borders, focus rings, icons). */
  largeTextOrUi: 3,
} as const;
