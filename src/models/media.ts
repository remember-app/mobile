import type { LabelId, MediaId, ProjectId, ProjectItemId } from '@/types/id';

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

export type MediaMeta = {
  dimensions: { width: number; height: number } | null;
  duration: number | null;
  at: Date | null;
  place: MediaPlace | null;
  camera: MediaCamera | null;
};

export type Media = {
  id: MediaId;
  kind: MediaKind;
  fingerprint: string;
  perceptualHash: string;
  format: string;
  bytes: number;
  meta: MediaMeta;
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
  scoreImportance?: number;
  scoreQuality?: number;
  tags: AnalysisTags | null;
  frames?: AnalysisSegment[] | null;
  sounds?: AnalysisSegment[] | null;
  words?: AnalysisSegment[] | null;
};

export type DownloadLink = {
  itemId: ProjectItemId;
  url: string;
};

export type PreviewSize = 'small' | 'middle' | 'large';

export type Item = {
  id: ProjectItemId;
  projectId: ProjectId;
  kind: MediaKind;
  media: Media;
  links: {
    original: string | null;
    compressed: string | null;
    previews: Partial<Record<PreviewSize, string>>;
  };
  uploader: PublicUser | null;
  comment: string | null;
  labelIds: LabelId[];
  analysis: Analysis | null;
  createdAt: Date;
};

export function itemSource(item: Item): string | null {
  return (
    item.links.previews.middle ??
    item.links.previews.small ??
    item.links.compressed ??
    item.links.original
  );
}

export function itemPreview(item: Item, size: PreviewSize): string | null {
  return item.links.previews[size] ?? itemSource(item);
}

export function itemPlayback(item: Item): string | null {
  return item.links.compressed ?? item.links.original;
}

/** Дата кадра: съёмки, если известна, иначе загрузки — одно правило на всё приложение. */
export function itemDate(item: Item): Date {
  return item.media.meta.at ?? item.createdAt;
}
