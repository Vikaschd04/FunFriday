'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, Dialog } from '@funfriday/ui';
import { isSafeInternalHref } from '@/lib/safe-href';

/** What the page currently being edited tells the shell. Client-only; not server state. */
export interface UnsavedGuard {
  dirty: boolean;
  /** Saves the draft; resolves true when saved (so navigation can continue). */
  save: () => boolean;
  /** Called after the leave dialog closed without leaving, so the page can place focus itself. */
  restoreFocus?: () => void;
}

interface GuardContextValue {
  setGuard: (guard: UnsavedGuard | null) => void;
  /** Returns true when navigation may proceed now; otherwise opens the leave dialog. */
  requestNavigation: (href: string, trigger?: HTMLElement) => boolean;
}

const GuardContext = createContext<GuardContextValue | null>(null);

export function UnsavedGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const guardRef = useRef<UnsavedGuard | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  // Safari does not focus links on click, so remember the trigger for focus return.
  const triggerRef = useRef<HTMLElement | null>(null);
  const refocusAfterClose = useRef(false);

  const setGuard = useCallback((guard: UnsavedGuard | null) => {
    guardRef.current = guard;
  }, []);

  const requestNavigation = useCallback((href: string, trigger?: HTMLElement) => {
    if (!guardRef.current?.dirty) return true;
    // Never open the dialog for a target that could leave the site; the link handles it normally.
    if (!isSafeInternalHref(href)) return true;
    triggerRef.current = trigger ?? null;
    setPending(href);
    return false;
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (guardRef.current?.dirty) {
        event.preventDefault();
        // Legacy browsers need a returnValue to show the native prompt.
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  // Focus requests made while the modal dialog is open are ignored (the page is inert), so the
  // page is asked again once the dialog has closed.
  useEffect(() => {
    if (pending === null && refocusAfterClose.current) {
      refocusAfterClose.current = false;
      guardRef.current?.restoreFocus?.();
    }
  }, [pending]);

  const value = useMemo(() => ({ setGuard, requestNavigation }), [setGuard, requestNavigation]);

  const leave = () => {
    const href = pending;
    // Clear the guard first so the navigation is not blocked again. The page changes, so
    // focus must not return to the old link.
    guardRef.current = null;
    triggerRef.current = null;
    setPending(null);
    if (href && isSafeInternalHref(href)) router.push(href);
  };

  return (
    <GuardContext value={value}>
      {children}
      <Dialog
        open={pending !== null}
        onClose={() => {
          setPending(null);
        }}
        returnFocusRef={triggerRef}
        title="Leave without saving?"
        description="You have changes that aren't saved on this device."
        actions={
          <>
            <Button
              variant="secondary"
              data-autofocus
              onClick={() => {
                setPending(null);
              }}
            >
              Keep editing
            </Button>
            <Button
              onClick={() => {
                // The action (not Escape) closes the dialog: the page decides where focus goes
                // (the leave target, or the error summary after an invalid save).
                triggerRef.current = null;
                if (guardRef.current?.save()) {
                  leave();
                } else {
                  refocusAfterClose.current = true;
                  setPending(null);
                }
              }}
            >
              Save draft
            </Button>
            <Button
              variant="ghost"
              className="text-ff-coral-700! hover:bg-ff-coral-50"
              onClick={leave}
            >
              Leave without saving
            </Button>
          </>
        }
      />
    </GuardContext>
  );
}

export function useUnsavedGuardRegistry(): GuardContextValue | null {
  return use(GuardContext);
}

/** Registers the page's dirty state with the shell; cleared on unmount. */
export function useRegisterUnsavedGuard(guard: UnsavedGuard): void {
  const registry = use(GuardContext);
  const latest = useRef(guard);
  useEffect(() => {
    latest.current = guard;
  });
  useEffect(() => {
    registry?.setGuard({
      get dirty() {
        return latest.current.dirty;
      },
      save: () => latest.current.save(),
      restoreFocus: () => {
        latest.current.restoreFocus?.();
      },
    });
    return () => {
      registry?.setGuard(null);
    };
  }, [registry]);
}

/** next/link that asks the shell before leaving a page with unsaved changes. */
export function GuardedLink({ href, onClick, ...rest }: ComponentProps<typeof Link>) {
  const registry = use(GuardContext);
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    const target = typeof href === 'string' ? href : (href.pathname ?? '/');
    if (registry && !registry.requestNavigation(target, event.currentTarget))
      event.preventDefault();
  };
  return <Link {...rest} href={href} onClick={handle} />;
}
