/** WCAG 2.1.4: single-key shortcuts can be turned off, and act only inside the game panel. */
export const SHORTCUTS_KEY = 'funfriday:live-shortcuts';

export function parseShortcutsSetting(stored: string | null): boolean {
  return stored !== 'off';
}

/** Maps a keydown to an answer, or null if it is not an (unmodified) answer key. */
export function answerForKey(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
}): 'A' | 'B' | 'pass' | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.repeat) return null;
  if (event.key === '1') return 'A';
  if (event.key === '2') return 'B';
  if (event.key === '0') return 'pass';
  return null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    typeof HTMLElement !== 'undefined' &&
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}
