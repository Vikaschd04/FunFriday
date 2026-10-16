const LINK = /https?:\/\/[^\s<>"']+/g;

/** Absolute http(s) links in a plain-text mail body, without trailing punctuation. */
export function extractLinks(text: string): string[] {
  const links = (text.match(LINK) ?? []).map((link) => link.replace(/[.,;:!?)\]]+$/, ''));
  return [...new Set(links)];
}
