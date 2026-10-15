/**
 * Only same-site absolute paths may be used as in-app navigation targets.
 * Rejects protocol-relative ("//host"), backslash tricks ("/\host"), schemes, relative paths
 * and control characters.
 */
export function isSafeInternalHref(href: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/\\')) return false;
  for (const char of href) {
    if (char.charCodeAt(0) < 32) return false;
  }
  return true;
}
