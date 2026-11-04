export function pictureKey(uri: string): string {
  const cut = uri.search(/[?#]/);
  return cut < 0 ? uri : uri.slice(0, cut);
}
