import type { MediaId, SongId, UserId } from '@/types/id';

export type Song = {
  id: SongId;
  name: string;
  author: string | null;
  originalId: MediaId;
  compressedId: MediaId | null;
  coverId: MediaId | null;
  previewCoverId: MediaId | null;
  coverUrl: string | null;
  previewCoverUrl: string | null;
  duration: number | null;
  uploadedBy: UserId | null;
};

export type SongWithUrl = Song & {
  url: string;
};

/** Песни проекта и личная библиотека без повторов — один пул для выбора музыки. */
export function songPool(...lists: readonly (readonly Song[])[]): Song[] {
  const seen = new Set<MediaId>();
  const pool: Song[] = [];
  for (const song of lists.flat()) {
    if (seen.has(song.originalId)) continue;
    seen.add(song.originalId);
    pool.push(song);
  }
  return pool;
}
