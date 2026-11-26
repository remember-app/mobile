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
export type ItemLinkVariant = 'large' | 'detail' | 'playback' | 'original';

export type ItemVariants = {
  original: MediaId;
  compressed: MediaId | null;
  previews: Partial<Record<PreviewSize, MediaId>>;
};

export type Item = {
  id: ProjectItemId;
  projectId: ProjectId;
  kind: MediaKind;
  media: Media;
  variants: ItemVariants;
  links: {
    small: string | null;
    middle: string | null;
  };
  uploader: PublicUser | null;
  comment: string | null;
  labelIds: LabelId[];
  analysis: Analysis | null;
  createdAt: Date;
};

export function itemThumb(item: Item): string | null {
  return item.links.middle ?? item.links.small;
}

export function hasVariant(item: Item, variant: ItemLinkVariant): boolean {
  if (variant === 'original') return true;
  if (variant === 'large') return item.variants.previews.large !== undefined;
  return item.variants.compressed !== null && (variant === 'detail') === (item.kind === 'photo');
}

/** Дата кадра: съёмки, если известна, иначе загрузки — одно правило на всё приложение. */
export function itemDate(item: Item): Date {
  return item.media.meta.at ?? item.createdAt;
}
