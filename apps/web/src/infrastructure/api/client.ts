const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiClientOptions = {
  authToken?: string;
  idempotencyKey?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return status >= 500 && status < 600;
  }
  return true; // network/timeout: retry
}

async function requestWithRetry<T>(
  path: string,
  options: RequestInit & ApiClientOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (options.authToken) {
    headers.set('Authorization', `Bearer ${options.authToken}`);
  }
  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const isJson =
        res.headers.get('content-type')?.includes('application/json') ?? false;
      const body = isJson ? await res.json() : await res.text();

      if (!res.ok) {
        const rawMessage = isJson ? body?.message ?? body?.error : body;
        const message = Array.isArray(rawMessage)
          ? rawMessage.join('\n')
          : typeof rawMessage === 'string'
            ? rawMessage
            : 'Error en la solicitud';
        const err: { status: number; message: string; [k: string]: unknown } = {
          status: res.status,
          message,
        };
        if (isJson && body && typeof body === 'object' && body !== null) {
          Object.assign(err, body);
        }
        if (isRetryable(err) && attempt < MAX_RETRIES - 1) {
          lastError = err;
          await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
          continue;
        }
        throw err;
      }

      return body as T;
    } catch (e) {
      clearTimeout(timeoutId);
      lastError = e;
      const isNetworkOrTimeout =
        e instanceof TypeError ||
        (e instanceof Error && e.name === 'AbortError');
      if ((isNetworkOrTimeout || isRetryable(e)) && attempt < MAX_RETRIES - 1) {
        await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
        continue;
      }
      throw e;
    }
  }

  throw lastError ?? new Error('Error en la solicitud');
}

export const apiClient = {
  get: <T>(path: string, init?: RequestInit & ApiClientOptions) =>
    requestWithRetry<T>(path, { ...init, method: 'GET' }),
  post: <T>(
    path: string,
    body?: unknown,
    init?: RequestInit & ApiClientOptions,
  ) =>
    requestWithRetry<T>(path, {
      ...init,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(
    path: string,
    body?: unknown,
    init?: RequestInit & ApiClientOptions,
  ) =>
    requestWithRetry<T>(path, {
      ...init,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, init?: RequestInit & ApiClientOptions) =>
    requestWithRetry<T>(path, { ...init, method: 'DELETE' }),
};

/** Indica si el error es de red/timeout (para encolar como pendiente). */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message?.includes('fetch')) return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    return status == null;
  }
  return false;
}
