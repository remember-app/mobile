// The API base URL. Expo inlines EXPO_PUBLIC_* at build time, so it has to be
// read as a literal property access — destructuring or dynamic keys stay undefined.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const TIMEOUT_MS = 5000;

/** The health payload the api service returns. Duplicated here on purpose: no shared types package. */
type Health = { status: string };

/** true when the api answers GET /health with 200 {"status":"ok"}. */
export async function isApiHealthy(): Promise<boolean> {
  const abort = new AbortController();
  // Without this an unreachable host hangs for a minute and the screen stays on "checking".
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}/health`, { signal: abort.signal });
    if (!response.ok) return false;
    const body = (await response.json()) as Health;
    return body.status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
