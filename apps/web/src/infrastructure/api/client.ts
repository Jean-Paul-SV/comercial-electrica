const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(
  path: string,
  options: RequestInit & { authToken?: string } = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (options.authToken) {
    headers.set('Authorization', `Bearer ${options.authToken}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

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
    throw err;
  }

  return body as T;
}

export const apiClient = {
  get: <T>(path: string, init?: RequestInit & { authToken?: string }) =>
    request<T>(path, { ...init, method: 'GET' }),
  post: <T>(
    path: string,
    body?: unknown,
    init?: RequestInit & { authToken?: string },
  ) =>
    request<T>(path, {
      ...init,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(
    path: string,
    body?: unknown,
    init?: RequestInit & { authToken?: string },
  ) =>
    request<T>(path, {
      ...init,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, init?: RequestInit & { authToken?: string }) =>
    request<T>(path, { ...init, method: 'DELETE' }),
};

