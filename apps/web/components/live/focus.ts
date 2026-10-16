/** Moves focus to the current phase heading (question h1, reveal sentence, summary h1...). */
export function focusLiveHeading(): void {
  const heading =
    document.querySelector<HTMLElement>('[data-live-heading]') ??
    document.querySelector<HTMLElement>('main h1');
  if (!heading) return;
  heading.setAttribute('tabindex', '-1');
  heading.focus();
}

/** After a render commit (state arrives from the server asynchronously). */
export function focusLater(action: () => void): void {
  setTimeout(action, 60);
}
