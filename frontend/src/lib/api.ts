/**
 * Typed API client for the Pluto backend.
 *
 * - Attaches the bearer token to every request
 * - Applies a timeout and supports caller cancellation
 * - Normalizes failures into ApiError (status, machine code, request ID for support)
 * - Signs the user out when the session expires
 * - Streams Server-Sent Events from POST endpoints
 */

// Empty string = same origin (e.g. nginx proxies /api to the backend in the Docker image)
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const API_PREFIX = '/api/v1';
const DEFAULT_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(message: string, status: number, code = 'error', requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

interface ApiHooks {
  getToken: () => string | null | undefined;
  onUnauthorized: () => void;
}

let hooks: ApiHooks = { getToken: () => null, onUnauthorized: () => {} };

/** Registered by the auth store at startup (avoids a circular import). */
export function configureApi(next: ApiHooks) {
  hooks = next;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON body (serialized automatically) */
  json?: unknown;
  /** Raw body, e.g. FormData for uploads */
  body?: BodyInit;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Attach the session token (default true) */
  auth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`${API_URL}${API_PREFIX}${path}`, window.location.origin);
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  return url.toString();
}

function buildHeaders(opts: RequestOptions): Headers {
  const headers = new Headers();
  if (opts.json !== undefined) headers.set('Content-Type', 'application/json');
  const token = opts.auth === false ? null : hooks.getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

/** Combines a caller's AbortSignal with a timeout. */
function withTimeout(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

async function toApiError(response: Response): Promise<ApiError> {
  let data: { detail?: unknown; code?: string; request_id?: string } = {};
  try {
    data = await response.json();
  } catch {
    /* non-JSON error body */
  }
  const detail = typeof data.detail === 'string' ? data.detail : response.statusText || 'Request failed';
  return new ApiError(detail, response.status, data.code || `http_${response.status}`,
    data.request_id || response.headers.get('x-request-id') || undefined);
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const t = withTimeout(opts.signal, timeoutMs);
  let response: Response;
  try {
    response = await fetch(buildUrl(path, opts.query), {
      method: opts.method || (opts.json !== undefined || opts.body ? 'POST' : 'GET'),
      headers: buildHeaders(opts),
      body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
      signal: t.signal,
    });
  } catch {
    t.cleanup();
    if (t.didTimeout()) throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`, 408, 'timeout');
    if (opts.signal?.aborted) throw new ApiError('Request cancelled.', 499, 'cancelled');
    throw new ApiError('Cannot reach the Pluto server. Check your connection.', 0, 'network_error');
  }

  if (!response.ok) {
    t.cleanup();
    const error = await toApiError(response);
    if (response.status === 401 && opts.auth !== false) hooks.onUnauthorized();
    throw error;
  }
  // Streaming callers own the body; clear the timeout once headers have arrived
  t.cleanup();
  return response;
}

export async function apiFetch<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const response = await send(path, opts);
  if (response.status === 204) return undefined as T;
  const type = response.headers.get('content-type') || '';
  return (type.includes('application/json') ? response.json() : response.text()) as Promise<T>;
}

export interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * POSTs JSON and invokes `onEvent` for each Server-Sent Event until the stream ends.
 * The timeout only covers the wait for response headers; an active stream can run longer.
 */
export async function streamSSE(path: string, json: unknown, onEvent: (event: SSEEvent) => void,
  opts: Pick<RequestOptions, 'signal' | 'timeoutMs'> = {}): Promise<void> {
  const response = await send(path, { method: 'POST', json, ...opts });
  if (!response.body) throw new ApiError('Streaming is not supported by this browser.', 0, 'no_stream');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (raw: string) => {
    const data = raw
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) return;
    try {
      onEvent(JSON.parse(data) as SSEEvent);
    } catch {
      /* ignore malformed frames */
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        dispatch(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
    }
    if (buffer.trim()) dispatch(buffer);
  } catch (err) {
    if (opts.signal?.aborted) throw new ApiError('Request cancelled.', 499, 'cancelled');
    throw err;
  } finally {
    reader.releaseLock();
  }
}

/** Human-readable message for any thrown value. */
export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
