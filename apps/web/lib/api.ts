import { readinessResponseSchema, type ReadinessResponse } from '@funfriday/contracts';

export const DEFAULT_API_BASE_URL = 'http://localhost:4000/api/v1';
export const READINESS_TIMEOUT_MS = 5000;

export type ReadinessResult =
  | { kind: 'ready'; data: ReadinessResponse }
  | { kind: 'not_ready'; data: ReadinessResponse }
  | { kind: 'unreachable' }
  | { kind: 'invalid_response' };

export interface FetchReadinessOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;
}

/**
 * Calls GET {base}/health/ready. Both 200 (ready) and 503 (not_ready) carry a
 * body that must match the shared contract; anything else is not trusted.
 */
export async function fetchReadiness(
  baseUrl: string,
  { fetchImpl = fetch, signal, timeoutMs = READINESS_TIMEOUT_MS }: FetchReadinessOptions = {},
): Promise<ReadinessResult> {
  const url = `${baseUrl.replace(/\/+$/, '')}/health/ready`;
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (signal) signals.push(signal);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.any(signals),
    });
  } catch {
    // Network failure, CORS block, timeout or caller abort.
    return { kind: 'unreachable' };
  }

  if (response.status !== 200 && response.status !== 503) {
    return { kind: 'invalid_response' };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'invalid_response' };
  }

  const parsed = readinessResponseSchema.safeParse(body);
  if (!parsed.success) return { kind: 'invalid_response' };

  // HTTP status and body status must agree.
  if (response.status === 200 && parsed.data.status === 'ready') {
    return { kind: 'ready', data: parsed.data };
  }
  if (response.status === 503 && parsed.data.status === 'not_ready') {
    return { kind: 'not_ready', data: parsed.data };
  }
  return { kind: 'invalid_response' };
}
