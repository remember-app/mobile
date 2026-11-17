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
