import type { MediaId, ProjectId, SongId, UserId } from '@/types/id';

export type Song = {
  id: SongId;
  name: string;
  author: string;
  mediaId: MediaId;
  projectId: ProjectId | null;
  uploadedBy: UserId | null;
};

export type SongWithUrl = Song & {
  url: string;
};
