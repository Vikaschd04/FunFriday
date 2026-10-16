/**
 * Full-page navigation. Used after sign-in/out and session expiry so every in-memory cache
 * (React state, Next router cache, prefetched redirects) is dropped along with the session.
 */
export function hardNavigate(href: string): void {
  window.location.assign(href);
}
