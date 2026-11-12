import { config } from '@/config';
import type { ApiErrorCode } from '@/types/api';

import type { ApiErrorWire } from './wire';

export class ApiError extends Error {
  readonly code: ApiErrorCode | null;
  readonly details: Record<string, unknown> | null;

  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    const parsed = body as Partial<ApiErrorWire> | null;
    const code = typeof parsed?.error === 'string' ? (parsed.error as ApiErrorCode) : null;
    super(code ?? `request failed with ${status}`);
    this.name = 'ApiError';
    this.code = code;
    this.details = parsed?.details ?? null;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export function query(params: Query): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(name, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  timeout?: number;
};

const refusals = new Set<(token: string) => void>();

export function onSessionRefused(listener: (token: string) => void): () => void {
  refusals.add(listener);
  return () => {
    refusals.delete(listener);
  };
}

export async function request<T>(
  path: string,
  { method = 'GET', body, token, timeout = config.api.timeoutMs }: Options = {},
): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  try {
    const response = await fetch(`${config.api.baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: abort.signal,
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (response.status === 401 && token !== undefined) {
      for (const listener of refusals) listener(token);
    }
    if (!response.ok) throw new ApiError(response.status, parsed);
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}
