import type { PageResponse } from './common';

export type SongResponse = {
  id: string;
  name: string;
  author: string | null;
  mediaId: string;
  coverId: string | null;
  coverUrl: string | null;
  description: string | null;
  duration: number | null;
  uploadedBy: string | null;
};

export type SongWithUrlResponse = SongResponse & {
  url: string;
};

export type SongsPageResponse = PageResponse<SongResponse>;

export type CreateSongRequest = {
  name: string;
  author: string;
  mediaId: string;
  coverId?: string | null;
  description?: string | null;
};
