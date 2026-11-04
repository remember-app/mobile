import type {
  Account,
  AppInvite,
  Contact,
  Item,
  JoinResult,
  Label,
  Login,
  Media,
  Member,
  Project,
  ProjectCard,
  ProjectInvite,
  PublicUser,
  Session,
  Song,
  SongWithUrl,
  Upload,
  UploadComplete,
  UploadPlan,
  User,
} from '@/models';
import type { CursorPage, Page } from '@/types/api';

import type {
  AccountWire,
  AppInviteWire,
  ContactWire,
  CursorPageWire,
  ItemWire,
  JoinResultWire,
  LabelWire,
  LoginResultWire,
  MediaWire,
  MemberWire,
  OffsetPageWire,
  ProjectCardWire,
  ProjectInviteWire,
  ProjectSummaryWire,
  PublicUserWire,
  SessionWire,
  SongWire,
  SongWithUrlWire,
  UploadCompleteWire,
  UploadPlanWire,
  UploadWire,
  UserWire,
} from './wire';

const date = (value: string): Date => new Date(value);

const dateOrNull = (value: string | null): Date | null => (value === null ? null : date(value));

const count = (value: string): number => {
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

export function toUser(wire: UserWire): User {
  return { id: wire.id, username: wire.username, name: wire.name, email: wire.email };
}

export function toPublicUser(wire: PublicUserWire): PublicUser {
  return { id: wire.id, username: wire.username, name: wire.name };
}

export function toAccount(wire: AccountWire): Account {
  return {
    ...toUser(wire),
    limits: { tokens: count(wire.limits.tokens), storageBytes: count(wire.limits.storageBytes) },
  };
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
    coverUrl: wire.coverUrl,
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
