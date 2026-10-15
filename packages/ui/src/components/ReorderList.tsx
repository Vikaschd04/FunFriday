'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from './cn.js';

export interface ReorderItem {
  id: string;
  /** Plain-text name used in button labels and announcements. */
  label: string;
}

export interface ReorderListProps<T extends ReorderItem> {
  items: readonly T[];
  /** Called with the item id and its new zero-based index. The parent owns the order. */
  onMove: (id: string, toIndex: number) => void;
  onRemove?: (id: string) => void;
  renderItem?: (item: T, index: number) => ReactNode;
  /** Accessible name of the list. */
  'aria-label': string;
  className?: string;
}

const iconButton =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-ff-button border border-ff-border-strong bg-ff-surface text-ff-ink ' +
  'hover:bg-ff-violet-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-ff-surface';

/**
 * Keyboard-first ordered list: always-visible Move up / Move down buttons (drag is never required).
 * Focus stays on the same button of the moved row; moves are announced politely.
 */
export function ReorderList<T extends ReorderItem>({
  items,
  onMove,
  onRemove,
  renderItem,
  className,
  ...rest
}: ReorderListProps<T>) {
  const [announcement, setAnnouncement] = useState('');
  const [highlight, setHighlight] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const pendingFocus = useRef<{ id: string; dir: 'up' | 'down' } | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(highlightTimer.current);
    },
    [],
  );

  // Browsers can drop focus when a keyed node is moved in the DOM; restore it explicitly.
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    const target = listRef.current?.querySelector<HTMLElement>(
      `[data-reorder-id="${CSS.escape(pending.id)}"][data-reorder-dir="${pending.dir}"]`,
    );
    if (target && document.activeElement !== target) target.focus();
  }, [items]);

  const move = (item: T, index: number, dir: 'up' | 'down') => {
    const to = dir === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= items.length) return;
    pendingFocus.current = { id: item.id, dir };
    onMove(item.id, to);
    setAnnouncement(`${item.label} moved to position ${to + 1} of ${items.length}.`);
    setHighlight(item.id);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => {
      setHighlight(null);
    }, 600);
  };

  return (
    <div className={className}>
      <ol ref={listRef} aria-label={rest['aria-label']} className="flex flex-col gap-3">
        {items.map((item, index) => {
          const atStart = index === 0;
          const atEnd = index === items.length - 1;
          const position = `position ${index + 1} of ${items.length}`;
          return (
            <li
              key={item.id}
              className={cn(
                // Below sm: content full width, then a right-aligned actions row. From sm: one line.
                'flex flex-col gap-3 rounded-ff-card bg-ff-surface p-3 shadow-ff-sm sm:flex-row sm:items-center sm:gap-2',
                highlight === item.id && 'ff-highlight',
              )}
            >
              <div className="min-w-0 w-full flex-1">
                {renderItem ? (
                  renderItem(item, index)
                ) : (
                  <span className="font-semibold text-ff-ink">{item.label}</span>
                )}
              </div>
              <div className="flex shrink-0 justify-end gap-2">
                <button
                  type="button"
                  data-reorder-id={item.id}
                  data-reorder-dir="up"
                  aria-label={`Move ${item.label} up (${position})`}
                  aria-disabled={atStart ? true : undefined}
                  onClick={() => {
                    move(item, index, 'up');
                  }}
                  className={iconButton}
                >
                  <ArrowUp aria-hidden="true" className="size-5" />
                </button>
                <button
                  type="button"
                  data-reorder-id={item.id}
                  data-reorder-dir="down"
                  aria-label={`Move ${item.label} down (${position})`}
                  aria-disabled={atEnd ? true : undefined}
                  onClick={() => {
                    move(item, index, 'down');
                  }}
                  className={iconButton}
                >
                  <ArrowDown aria-hidden="true" className="size-5" />
                </button>
                {onRemove && (
                  <button
                    type="button"
                    aria-label={`Remove ${item.label}`}
                    onClick={() => {
                      onRemove(item.id);
                    }}
                    className={cn(iconButton, 'text-ff-coral-700!')}
                  >
                    <Trash2 aria-hidden="true" className="size-5" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
