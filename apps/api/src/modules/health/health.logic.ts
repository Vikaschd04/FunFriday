import type { DependencyCheck, ReadinessResponse } from '@funfriday/contracts';

export const DEPENDENCY_TIMEOUT_MS = 2_000;

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function summarizeReadiness(
  checks: ReadinessResponse['checks'],
): ReadinessResponse['status'] {
  return Object.values(checks).every((check: DependencyCheck) => check.status === 'up')
    ? 'ready'
    : 'not_ready';
}
