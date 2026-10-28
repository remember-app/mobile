/**
 * The key a picture off a signed link is filed under when there is no record to name — the object's
 * own path, with the signature cut off.
 *
 * The listing signs every link afresh on every read and each one lives a quarter of an hour, while
 * `expo-image`'s own key is the whole url: left that way, the same bytes are one more file on the
 * phone per read, and a screen drawing them downloads the lot again every time it opens. A mosaic
 * of a memory's own frames (`card_thumbnail_urls`, `recent_thumbnail_urls`) and a montage's poster
 * arrive as bare links with no id beside them, and this is what keeps them one file.
 *
 * The path is stable for the life of the object — the api signs the same key every time — so two
 * reads of one picture come out under one name. A link with no query at all is its own key.
 *
 * Its own module, with no imports, because the kit draws these pictures and the key must not drag
 * the api, the dictionary and the language store into every card that shows one.
 */
export function pictureKey(uri: string): string {
  const cut = uri.search(/[?#]/);
  return cut < 0 ? uri : uri.slice(0, cut);
}
