import { currentLanguage } from '@/lib/language';
import { strings } from '@/strings';
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
export const say = () => strings[currentLanguage()];
const TIMEOUT_MS = 5000;
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(describe(status, body));
    this.name = 'ApiError';
  }
}
export function apiReason(body: unknown): string | undefined {
  const reason =
    typeof body === 'object' && body !== null && 'error' in body
      ? (
          body as {
            error: unknown;
          }
        ).error
      : undefined;
  return typeof reason === 'string' ? reason : undefined;
}
function describe(status: number, body: unknown): string {
  if (status === 429) return say().error.tooMany;
  return apiReason(body) ?? say().error.status(status);
}
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : say().error.offline;
}
const refusals = new Set<(token: string) => void>();
export function onSessionRefused(listener: (token: string) => void): () => void {
  refusals.add(listener);
  return () => {
    refusals.delete(listener);
  };
}
type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  timeout?: number;
};
export async function request<T>(
  path: string,
  { method = 'GET', body, token, timeout = TIMEOUT_MS }: Options = {},
): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  try {
    const response = await fetch(`${API_URL}${path}`, {
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
