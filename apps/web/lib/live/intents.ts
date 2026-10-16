/**
 * One clientActionId per user INTENT. A retry of the same intent (after a timeout or a
 * "try again") reuses the id so the server can answer `duplicate` instead of applying twice;
 * a new intent gets a fresh id.
 */
export class IntentIds {
  private readonly open = new Map<string, string>();

  constructor(private readonly make: () => string = () => crypto.randomUUID()) {}

  idFor(signature: string): string {
    let id = this.open.get(signature);
    if (!id) {
      id = this.make();
      this.open.set(signature, id);
    }
    return id;
  }

  /** Call when the server gave a definitive answer; the next press is a new intent. */
  settle(signature: string): void {
    this.open.delete(signature);
  }
}

/** Failures after which retrying the SAME intent is the right move. */
export function isRetryable(code: string): boolean {
  return (
    code === 'SERVICE_UNAVAILABLE' ||
    code === 'INTERNAL_ERROR' ||
    code === 'RATE_LIMITED' ||
    code === 'timeout' ||
    code === 'offline'
  );
}
