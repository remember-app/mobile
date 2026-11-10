import type { MediaId, MontageId, MovieId, ProjectId, UserId } from '@/types/id';

import type { Montage } from './montage';

export type MovieVideo = {
  durationSeconds: number | null;
  bytes: number;
  width: number | null;
  height: number | null;
  format: string;
};

export type Movie = {
  id: MovieId;
  name: string;
  projectId: ProjectId;
  createdBy: UserId;
  createdAt: Date;
  montageId: MontageId;
  videoId: MediaId;
  video: MovieVideo | null;
  montage: Montage | null;
  thumbnailId: MediaId | null;
  previewId: MediaId | null;
  videoUrl: string | null;
  posterUrl: string | null;
  previewUrl: string | null;
};
