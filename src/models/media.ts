import type { LabelId, MediaId, ProjectId, ProjectItemId, UserId } from '@/types/id';

import type { PublicUser } from './user';

export type MediaKind = 'photo' | 'video' | 'audio';

export type MediaPlace = {
  latitude: number;
  longitude: number;
};

export type MediaCamera = {
  model: string | null;
  focalLengthMm: number | null;
  exposure: {
    aperture: number | null;
    iso: number | null;
    ev: number | null;
    shutter: string | null;
  };
};

export type Media = {
  id: MediaId;
  kind: MediaKind;
  format: string;
  bytes: number;
  dimensions: { width: number; height: number } | null;
  duration: number | null;
  capturedAt: Date | null;
  place: MediaPlace | null;
  camera: MediaCamera | null;
  uploadedBy: UserId | null;
};

export type Analysis = {
  description: string;
  speech: string | null;
  tags: string[];
  score: number;
};

export type DownloadLink = {
  itemId: ProjectItemId;
  url: string;
};

export type Item = {
  id: ProjectItemId;
  projectId: ProjectId;
  kind: MediaKind;
  media: Media;
  links: {
    original: string | null;
    thumbnail: string | null;
    preview: string | null;
  };
  uploader: PublicUser | null;
  description: string | null;
  labelIds: LabelId[];
  analysis: Analysis | null;
  createdAt: Date;
};
