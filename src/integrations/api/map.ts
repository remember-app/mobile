import type {
  Account,
  AppInvite,
  Consumable,
  Contact,
  Item,
  JoinResult,
  Label,
  Login,
  Media,
  Member,
  Montage,
  MontageTemplate,
  Movie,
  Project,
  ProjectCard,
  ProjectInvite,
  PublicUser,
  Session,
  Song,
  SongWithUrl,
  SystemMediaItem,
  Upload,
  UploadComplete,
  UploadPlan,
  User,
} from '@/models';
import type { CursorPage, Page } from '@/types/api';

import type {
  AccountWire,
  AppInviteWire,
  ConsumableWire,
  ContactWire,
  CursorPageWire,
  ItemWire,
  JoinResultWire,
  LabelWire,
  LoginResultWire,
  MediaWire,
  MemberWire,
  MontageTemplateWire,
  MontageWire,
  MovieWire,
  OffsetPageWire,
  ProjectCardWire,
  ProjectInviteWire,
  ProjectSummaryWire,
  PublicUserWire,
  SessionWire,
  SongWire,
  SongWithUrlWire,
  SystemMediaItemWire,
  UploadCompleteWire,
  UploadPlanWire,
  UploadWire,
  UserWire,
} from './wire';

const date = (value: string): Date => new Date(value);

const dateOrNull = (value: string | null): Date | null => (value === null ? null : date(value));

const count = (value: string | number): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`not a safe integer: ${value}`);
  return parsed;
};

export function toPage<From, To>(wire: OffsetPageWire<From>, map: (item: From) => To): Page<To> {
  return { items: wire.items.map(map), nextOffset: wire.nextOffset };
}

export function toCursorPage<From, To>(
  wire: CursorPageWire<From>,
  map: (item: From) => To,
): CursorPage<To> {
  return { items: wire.items.map(map), nextCursor: wire.nextCursor };
}

export function toConsumable(wire: ConsumableWire): Consumable {
  return {
    tokens: { tokens: count(wire.tokens.tokens), spend: count(wire.tokens.spend) },
    storage: { bytes: count(wire.storage.bytes), spend: count(wire.storage.spend) },
  };
}

export function toUser(wire: UserWire): User {
  return {
    id: wire.id,
    username: wire.username,
    name: wire.name,
    email: wire.email,
    language: wire.language,
    registered: wire.registered,
    profileMediaId: wire.profileMediaId,
  };
}

export function toPublicUser(wire: PublicUserWire): PublicUser {
  return {
    id: wire.id,
    username: wire.username,
    name: wire.name,
    profileMediaId: wire.profileMediaId,
  };
}

export function toAccount(wire: AccountWire): Account {
  return { ...toUser(wire), consumables: toConsumable(wire.consumables) };
}

export function toLoginResult(wire: LoginResultWire): Login {
  return { token: wire.token, user: toUser(wire.user) };
}

export function toSession(wire: SessionWire): Session {
  return {
    id: wire.id,
    createdAt: date(wire.createdAt),
    expiresAt: date(wire.expiresAt),
    current: wire.current,
  };
}

export function toMember(wire: MemberWire): Member {
  return {
    userId: wire.userId,
    username: wire.username,
    name: wire.name,
    role: wire.role,
    consumables: toConsumable(wire.consumables),
    contribution: wire.contribution,
    joinedAt: date(wire.joinedAt),
    invitedBy: wire.invitedBy,
  };
}

function toSummary(wire: ProjectSummaryWire): Project {
  return {
    id: wire.id,
    title: wire.title,
    eventStart: date(wire.eventStart),
    eventEnd: dateOrNull(wire.eventEnd),
    consumables: toConsumable(wire.consumables),
    itemCount: wire.itemCount,
    memberCount: wire.memberCount,
    sharedCount: wire.sharedCount,
    myRole: wire.myRole,
    myContribution: wire.myContribution,
  };
}

export const toProject = toSummary;

export function toProjectCard(wire: ProjectCardWire): ProjectCard {
  return { ...toSummary(wire), previewUrls: wire.previewUrls };
}

export function toMedia(wire: MediaWire): Media {
  const base = {
    id: wire.id,
    kind: wire.kind,
    format: wire.format,
    bytes: count(wire.bytes),
    capturedAt: dateOrNull(wire.capturedAt),
    place: wire.place
      ? {
          latitude: wire.place.latitude,
          longitude: wire.place.longitude,
        }
      : null,
    uploadedBy: wire.uploadedBy,
  };
  if (wire.kind === 'photo') {
    return { ...base, dimensions: wire.dimensions, duration: null, camera: wire.camera };
  }
  if (wire.kind === 'video') {
    return { ...base, dimensions: wire.dimensions, duration: wire.duration, camera: wire.camera };
  }
  return { ...base, dimensions: null, duration: wire.duration, camera: null };
}

export function toItem(wire: ItemWire): Item {
  return {
    id: wire.item.id,
    projectId: wire.item.projectId,
    kind: wire.media.kind,
    media: toMedia(wire.media),
    links: wire.links,
    uploader: wire.uploader ? toPublicUser(wire.uploader) : null,
    description: wire.item.description,
    labelIds: wire.item.labelIds,
    analysis: wire.item.analysis,
    createdAt: date(wire.item.createdAt),
  };
}

export function toUpload(wire: UploadWire): Upload {
  return {
    id: wire.id,
    projectId: wire.projectId,
    kind: wire.kind,
    fileName: wire.fileName,
    declaredBytes: count(wire.declaredBytes),
    status: wire.status,
    derive: wire.derive,
    errorCode: wire.errorCode,
    error: wire.error,
    mediaId: wire.mediaId,
    uploader: wire.uploader ? toPublicUser(wire.uploader) : null,
    createdAt: date(wire.createdAt),
  };
}

export function toUploadPlan(wire: UploadPlanWire): UploadPlan {
  return { id: wire.id, path: wire.path, partBytes: wire.partBytes, parts: wire.parts };
}

export function toUploadComplete(wire: UploadCompleteWire): UploadComplete {
  return { mediaId: wire.mediaId, itemId: wire.itemId, status: wire.status };
}

export function toLabel(wire: LabelWire): Label {
  return {
    id: wire.id,
    projectId: wire.projectId,
    ownerId: wire.ownerId,
    name: wire.name,
    color: wire.colorHex as `#${string}`,
    description: wire.description,
    shared: wire.shared,
    itemCount: wire.itemCount,
    createdAt: date(wire.createdAt),
  };
}

export function toContact(wire: ContactWire): Contact {
  return { userId: wire.contactId, username: wire.username, name: wire.name };
}

export function toProjectInvite(wire: ProjectInviteWire): ProjectInvite {
  return { token: wire.token, role: wire.role };
}

export function toAppInvite(wire: AppInviteWire): AppInvite {
  return { token: wire.token, maxUses: wire.maxUses };
}

export function toJoinResult(wire: JoinResultWire): JoinResult {
  return 'joined' in wire ? { joined: true } : { project: toProject(wire) };
}

export function toSong(wire: SongWire): Song {
  return {
    id: wire.id,
    name: wire.name,
    author: wire.author,
    mediaId: wire.mediaId,
    projectId: wire.projectId,
    uploadedBy: wire.uploadedBy,
  };
}

export function toSongWithUrl(wire: SongWithUrlWire): SongWithUrl {
  return { ...toSong(wire), url: wire.url };
}

export function toSystemMedia(wire: SystemMediaItemWire): SystemMediaItem {
  return {
    name: wire.name,
    mediaId: wire.mediaId,
    url: wire.url,
    width: wire.width,
    height: wire.height,
    captions: wire.captions,
  };
}

export function toMontage(wire: MontageWire): Montage {
  return {
    id: wire.id,
    projectId: wire.projectId,
    createdBy: wire.createdBy,
    status: wire.status,
    manifest: wire.manifest,
    journal: wire.journal,
    createdAt: date(wire.createdAt),
    error: wire.error,
  };
}

export function toMontageTemplate(wire: MontageTemplateWire): MontageTemplate {
  return {
    id: wire.id,
    name: wire.name,
    settings: {
      targetSeconds: wire.settings.targetSeconds,
      prompt: wire.settings.prompt,
      dimensions: wire.settings.dimensions,
      musicIds: wire.settings.musicIds,
    },
    referenceMediaId: wire.referenceMediaId,
  };
}

export function toMovie(wire: MovieWire): Movie {
  return {
    id: wire.id,
    name: wire.name,
    projectId: wire.projectId,
    createdBy: wire.createdBy,
    createdAt: date(wire.createdAt),
    montageId: wire.montageId,
    videoId: wire.videoId,
    video: wire.video,
    montage: wire.montage ? toMontage(wire.montage) : null,
    thumbnailId: wire.derived.thumbnailId,
    previewId: wire.derived.previewId,
    videoUrl: wire.video_url,
    posterUrl: wire.poster_url,
    previewUrl: wire.preview_url,
  };
}
