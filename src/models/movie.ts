import type { MediaId, MontageId, MovieId, ProjectId, UserId } from '@/types/id';

export type Movie = {
  id: MovieId;
  name: string;
  projectId: ProjectId;
  createdBy: UserId;
  createdAt: Date;
  montageId: MontageId;
  videoId: MediaId;
  thumbnailId: MediaId | null;
  previewId: MediaId | null;
  videoUrl: string | null;
  posterUrl: string | null;
  previewUrl: string | null;
};
