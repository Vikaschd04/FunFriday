/** Injectable time + one-shot timers so tests can drive server deadlines deterministically. */
export abstract class Clock {
  /** Epoch milliseconds. */
  abstract now(): number;
  /** Runs `fn` once at epoch `atMs` (or immediately-ish if already past). Returns a cancel function. */
  abstract schedule(atMs: number, fn: () => void): () => void;
}

export class SystemClock extends Clock {
  now(): number {
    return Date.now();
  }

  schedule(atMs: number, fn: () => void): () => void {
    const handle = setTimeout(fn, Math.min(Math.max(0, atMs - Date.now()), 2 ** 31 - 1));
    // Timers must never keep the process alive on their own.
    handle.unref();
    return () => clearTimeout(handle);
  }
}
