'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { SHORTCUTS_KEY, parseShortcutsSetting } from '@/lib/live/shortcuts';

const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return parseShortcutsSetting(window.localStorage.getItem(SHORTCUTS_KEY));
  } catch {
    return true;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Keyboard-shortcut preference: default ON, persisted, shared by every switch on the page. */
export function useShortcutsEnabled(): [boolean, (next: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, read, () => true);
  const set = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(SHORTCUTS_KEY, next ? 'on' : 'off');
    } catch {
      // Storage blocked: the preference lasts for this page view only (still applied below).
    }
    for (const listener of [...listeners]) listener();
  }, []);
  return [enabled, set];
}

export function ShortcutsSwitch({ idSuffix = '' }: { idSuffix?: string }) {
  const [enabled, setEnabled] = useShortcutsEnabled();
  return (
    <label className="flex min-h-11 items-center gap-3 text-ff-ink">
      <input
        id={`shortcuts-switch${idSuffix}`}
        type="checkbox"
        className="size-6 shrink-0 accent-[var(--ff-violet-700)]"
        checked={enabled}
        onChange={(e) => {
          setEnabled(e.target.checked);
        }}
      />
      <span className="font-semibold">Keyboard shortcuts</span>
    </label>
  );
}
