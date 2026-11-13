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
  fingerprint: string;
  format: string;
  bytes: number;
  dimensions: { width: number; height: number } | null;
  duration: number | null;
  capturedAt: Date | null;
  place: MediaPlace | null;
  camera: MediaCamera | null;
  uploadedBy: UserId | null;
};

export type AnalysisLevel = 'low' | 'medium' | 'high';

export type AnalysisTags = Record<string, string>;

export type AnalysisSegment = {
  secStart: number;
  secEnd: number;
  description: string;
  tags: AnalysisTags | null;
};

export type Analysis = {
  level: AnalysisLevel;
  summary: string;
  description: string;
  score: number;
  tags: AnalysisTags | null;
  frames?: AnalysisSegment[] | null;
  sounds?: AnalysisSegment[] | null;
  words?: AnalysisSegment[] | null;
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

export function itemSource(item: Item): string | null {
  return item.links.thumbnail ?? item.links.preview ?? item.links.original;
}
