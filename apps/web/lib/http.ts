import { getApiBaseUrl } from './api';

/**
 * Failure kinds shared by every identity/tenancy call. The UI switches on `kind`; nothing here
 * throws. Authorisation is always decided by the API: these kinds only describe its answer.
 */
export type ApiFailure =
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden'; code?: string; message?: string }
  | { kind: 'gone'; code?: string }
  | { kind: 'not_found' }
  | { kind: 'conflict'; code: string; message?: string }
  | { kind: 'invalid'; code?: string; message?: string; fieldErrors: Record<string, string[]> }
  | { kind: 'rate_limited' }
  | { kind: 'server_error' }
  | { kind: 'unreachable' }
  | { kind: 'invalid_response' };

/** Structural subset of a Zod schema, so this module needs no direct zod dependency. */
export interface ResponseSchema<T> {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false };
}

export type ApiResult<T> = { kind: 'ok'; data: T } | ApiFailure;

export interface RequestOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export const REQUEST_TIMEOUT_MS = 10_000;

interface JsonRequest<T> extends RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  /** Contract schema for a 2xx body. Omit for endpoints that return no body (204). */
  schema?: ResponseSchema<T>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function fieldErrorsFrom(details: unknown): Record<string, string[]> {
  const raw = asRecord(asRecord(details).fieldErrors);
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) out[key] = value.filter((v): v is string => typeof v === 'string');
  }
  return out;
}

/**
 * One JSON call with `credentials: 'include'`. Understands both our error envelope
 * (`{code,message,requestId,details}`) and the auth library's `{code,message}`.
 */
export async function requestJson<T>(options: JsonRequest<T>): Promise<ApiResult<T>> {
  const {
    fetchImpl = fetch,
    baseUrl = getApiBaseUrl(),
    method = 'GET',
    path,
    body,
    schema,
    signal,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = options;
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (signal) signals.push(signal);

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.any(signals),
    });
  } catch {
    return { kind: 'unreachable' };
  }

  if (response.ok) {
    if (!schema) return { kind: 'ok', data: undefined as T };
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { kind: 'invalid_response' };
    }
    const parsed = schema.safeParse(json);
    return parsed.success ? { kind: 'ok', data: parsed.data } : { kind: 'invalid_response' };
  }

  let errorBody: Record<string, unknown> = {};
  try {
    errorBody = asRecord(await response.json());
  } catch {
    // Non-JSON error bodies (proxies, crashes) fall through to the status mapping.
  }
  const code = typeof errorBody.code === 'string' ? errorBody.code : undefined;
  const message = typeof errorBody.message === 'string' ? errorBody.message : undefined;

  switch (response.status) {
    case 401:
      return { kind: 'unauthenticated' };
    case 403:
      return { kind: 'forbidden', code, message };
    case 404:
      return { kind: 'not_found' };
    case 409:
      return { kind: 'conflict', code: code ?? 'CONFLICT', message };
    case 410:
      return { kind: 'gone', code };
    case 429:
      return { kind: 'rate_limited' };
    case 400:
    case 422:
      return { kind: 'invalid', code, message, fieldErrors: fieldErrorsFrom(errorBody.details) };
    default:
      return response.status >= 500 ? { kind: 'server_error' } : { kind: 'invalid_response' };
  }
}
