'use client';

import { type ReactNode, type RefObject, useEffect, useId, useRef } from 'react';
import { cn } from './cn.js';

export interface DialogProps {
  open: boolean;
  /** Called on Escape, backdrop click or any close request. The parent sets `open` to false. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action buttons. Put the safe action (e.g. Cancel) first and mark it `data-autofocus`. */
  actions?: ReactNode;
  /**
   * Element to focus on close. Defaults to the element focused when the dialog opened.
   * If provided, a null `current` disables focus return.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * Modal built on native <dialog>.showModal(): inert background, top layer, Escape support.
 * Initial focus goes to `[data-autofocus]` (the safe action), otherwise the first focusable.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  returnFocusRef,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      const preferred = dialog.querySelector<HTMLElement>('[data-autofocus]');
      const first = dialog.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (preferred ?? first)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Restore focus after the dialog closes, whichever way it closed.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    // When a returnFocusRef is supplied it is authoritative: a null ref means "do not restore"
    // (the caller moves focus itself, e.g. after an action closed the dialog).
    const target = returnFocusRef ? returnFocusRef.current : opener.current;
    if (target?.isConnected) target.focus();
  }, [open, returnFocusRef]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        'ff-dialog m-auto w-[min(32rem,calc(100vw-2rem))] rounded-ff-dialog bg-ff-surface p-0 text-ff-ink shadow-ff-lg',
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="font-heading text-2xl leading-8 font-bold">
          {title}
        </h2>
        {description && (
          <p id={descId} className="text-ff-muted">
            {description}
          </p>
        )}
        {children}
        {actions && <div className="flex flex-wrap justify-end gap-3 pt-2">{actions}</div>}
      </div>
    </dialog>
  );
}
