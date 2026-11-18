import type { MediaId, SongId, UserId } from '@/types/id';

export type Song = {
  id: SongId;
  name: string;
  author: string | null;
  mediaId: MediaId;
  coverId: MediaId | null;
  coverUrl: string | null;
  description: string | null;
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
    if (seen.has(song.mediaId)) continue;
    seen.add(song.mediaId);
    pool.push(song);
  }
  return pool;
}
