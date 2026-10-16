/** Per-socket abuse limit (ADR 0003 decision 9): refills continuously, bursts up to `capacity`. */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity = 20,
    private readonly refillPerSecond = 10,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  /** True if the event may proceed. */
  take(): boolean {
    const t = this.now();
    this.tokens = Math.min(
      this.capacity,
      this.tokens + ((t - this.last) / 1000) * this.refillPerSecond,
    );
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
