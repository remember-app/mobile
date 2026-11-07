import type { ApiErrorCode } from '@/types/api';

export type ApiErrorWire = {
  error: ApiErrorCode;
  message?: string;
  details?: Record<string, unknown>;
};

export type OffsetPageWire<T> = {
  items: T[];
  nextOffset: number | null;
};

export type CursorPageWire<T> = {
  items: T[];
  nextCursor: string | null;
};

export type UserWire = {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  language: 'ru' | 'en';
  profileMediaId: string | null;
};

export type PublicUserWire = {
  id: string;
  username: string | null;
  name: string | null;
  profileMediaId: string | null;
};

export type ConsumableWire = {
  tokens: {
    tokens: number;
    spend: number;
  };
  storage: {
    bytes: number;
    spend: number;
  };
};

export type AccountWire = UserWire & {
  consumables: ConsumableWire;
};

export type SessionWire = {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};

export type RoleWire = 'admin' | 'contributor' | 'viewer';

export type ContributionWire = 'not_started' | 'more_coming' | 'done';

export type MemberWire = {
  userId: string;
  username: string | null;
  name: string | null;
  role: RoleWire;
  consumables: ConsumableWire;
  contribution: ContributionWire;
  joinedAt: string;
  invitedBy: string | null;
};

export type ProjectSummaryWire = {
  id: string;
  title: string;
  eventStart: string;
  eventEnd: string | null;
  consumables: ConsumableWire;
  itemCount: number;
  memberCount: number;
  sharedCount: number;
  myRole: RoleWire;
  myContribution: ContributionWire;
};

export type ProjectCardWire = ProjectSummaryWire & {
  previewUrls: string[];
};

export type ProjectWire = ProjectSummaryWire;

export type MediaPlaceWire = {
  latitude: number;
  longitude: number;
};

export type MediaCameraWire = {
  model: string | null;
  focalLengthMm: number | null;
  exposure: {
    aperture: number | null;
    iso: number | null;
    ev: number | null;
    shutter: string | null;
  };
};

type MediaCommonWire = {
  id: string;
  format: string;
  bytes: string;
  capturedAt: string | null;
  place: MediaPlaceWire | null;
  uploadedBy: string | null;
};

export type MediaWire =
  | (MediaCommonWire & {
      kind: 'photo';
      dimensions: { width: number; height: number } | null;
      camera: MediaCameraWire | null;
    })
  | (MediaCommonWire & {
      kind: 'video';
      dimensions: { width: number; height: number } | null;
      duration: number | null;
      camera: MediaCameraWire | null;
    })
  | (MediaCommonWire & {
      kind: 'audio';
      duration: number | null;
    });

export type AnalysisWire = {
  description: string;
  speech: string | null;
  tags: string[];
  score: number;
};

export type ItemWire = {
  item: {
    id: string;
    projectId: string;
    mediaId: string;
    description: string | null;
    labelIds: string[];
    analysis: AnalysisWire | null;
    createdAt: string;
  };
  media: MediaWire;
  uploader: PublicUserWire | null;
  links: {
    original: string | null;
    thumbnail: string | null;
    preview: string | null;
  };
};

export type UploadWire = {
  id: string;
  projectId: string;
  kind: 'photo' | 'video' | 'audio';
  fileName: string;
  declaredBytes: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  derive: 'queued' | 'running' | 'done' | 'failed' | null;
  errorCode: string | null;
  error: string | null;
  mediaId: string | null;
  uploader: PublicUserWire | null;
  createdAt: string;
};

export type UploadPlanWire = {
  id: string;
  path: string;
  partBytes: number;
  parts: string[];
};

export type UploadCompleteWire = {
  mediaId: string;
  itemId: string;
  status: 'processing';
};

export type LabelWire = {
  id: string;
  projectId: string;
  ownerId: string;
  name: string;
  colorHex: string;
  description: string | null;
  shared: boolean;
  itemCount: number;
  createdAt: string;
};

export type ContactWire = {
  contactId: string;
  username: string | null;
  name: string | null;
};

export type ProjectInviteWire = {
  token: string;
  role: RoleWire;
};

export type AppInviteWire = {
  token: string;
  maxUses: number | null;
};

export type DonateConsumablesWire = {
  project: ConsumableWire;
  member: ConsumableWire;
};

export type JoinResultWire = ProjectWire | { joined: true };

export type SongWire = {
  id: string;
  name: string;
  author: string;
  mediaId: string;
  projectId: string | null;
  uploadedBy: string | null;
};

export type SongWithUrlWire = SongWire & {
  url: string;
};

export type LoginStartWire = {
  ok: true;
  code?: string;
};

export type LoginResultWire = {
  token: string;
  user: UserWire;
};

export type DownloadLinksWire = {
  items: { itemId: string; url: string }[];
};
