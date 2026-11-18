import type { PageResponse } from './common';

export type SongResponse = {
  id: string;
  name: string;
  author: string | null;
  originalId: string;
  compressedId: string | null;
  coverId: string | null;
  previewCoverId: string | null;
  coverUrl: string | null;
  previewCoverUrl: string | null;
  duration: number | null;
  uploadedBy: string | null;
};

export type SongWithUrlResponse = SongResponse & {
  url: string;
};

export type SongsPageResponse = PageResponse<SongResponse>;
