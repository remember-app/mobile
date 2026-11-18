import type { CursorPageResponse } from './common';
import type { PublicUserResponse } from './user';

export type MediaKind = 'photo' | 'video' | 'audio';

export type PlaceResponse = {
  latitude: number;
  longitude: number;
};

export type ExposureResponse = {
  aperture: number | null;
  iso: number | null;
  ev: number | null;
  shutter: string | null;
};

export type CameraResponse = {
  model: string | null;
  focalLengthMm: number | null;
  exposure: ExposureResponse;
};

export type DimensionsResponse = {
  width: number;
  height: number;
};

export type MediaMetaResponse = {
  dimensions: DimensionsResponse | null;
  duration: number | null;
  at: string | null;
  place: PlaceResponse | null;
  camera: CameraResponse | null;
};

export type MediaResponse = {
  id: string;
  kind: MediaKind;
  fingerprint: string;
  perceptualHash: string;
  format: string;
  bytes: string;
  meta: MediaMetaResponse;
};

export type AnalysisTags = Record<string, string>;

export type AnalysisSegment = {
  secStart: number;
  secEnd: number;
  description: string;
  tags: AnalysisTags | null;
};

export type AnalysisResponse = {
  level: 'low' | 'medium' | 'high';
  summary: string;
  description: string;
  scoreImportance?: number;
  scoreQuality?: number;
  tags: AnalysisTags | null;
  frames?: AnalysisSegment[] | null;
  sounds?: AnalysisSegment[] | null;
  words?: AnalysisSegment[] | null;
};

export type ItemResponse = {
  item: {
    id: string;
    projectId: string;
    uploadedBy: string;
    comment: string | null;
    labelIds: string[];
    analysis: AnalysisResponse | null;
    createdAt: string;
  };
  media: MediaResponse;
  uploader: PublicUserResponse | null;
  links: {
    original: string | null;
    compressed: string | null;
    previews: Partial<Record<'small' | 'middle' | 'large', string>>;
  };
};

export type GalleryPageResponse = CursorPageResponse<ItemResponse>;

export type DownloadLinkResponse = {
  itemId: string;
  url: string;
};

export type MediaDownloadResponse = {
  url: string;
};

export type DownloadLinksRequest = {
  itemIds: string[];
};

export type DownloadLinksResponse = {
  items: DownloadLinkResponse[];
};

export type MediaPatchRequest = {
  capturedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type ItemCommentRequest = {
  comment: string | null;
};
