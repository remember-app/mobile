export async function putPart(url: string, bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 60_000);
  try {
    const response = await fetch(url, {
      method: 'PUT',
      body: bytes,
      signal: abort.signal,
    });
    if (!response.ok) throw new Error(`storage answered ${response.status}`);
    const etag = response.headers.get('etag');
    if (!etag) throw new Error('storage sent no etag');
    return etag;
  } finally {
    clearTimeout(timer);
  }
}
