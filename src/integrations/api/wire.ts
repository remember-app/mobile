import type {
  AccountResponse,
  AnalysisResponse,
  ApiErrorResponse,
  AppInviteResponse,
  AvatarResponse,
  AvatarStartResponse,
  CameraResponse,
  ConsumableResponse,
  ContactResponse,
  ContributionStatus,
  CursorPageResponse,
  DonateConsumablesResponse,
  DownloadLinksResponse,
  ItemResponse,
  JoinResponse,
  LabelResponse,
  LoginResponse,
  LoginStartResponse,
  MediaResponse,
  MemberResponse,
  PageResponse,
  PlaceResponse,
  ProjectCardResponse,
  ProjectInviteResponse,
  ProjectResponse,
  PublicUserResponse,
  Role,
  SessionResponse,
  SongResponse,
  SongWithUrlResponse,
  SuggestionsPageResponse,
  SystemMediaItem,
  SystemMediaResponse,
  UploadCompleteResponse,
  UploadPlanResponse,
  UploadResponse,
  UserResponse,
} from './contract';

export type ApiErrorWire = ApiErrorResponse;
export type OffsetPageWire<T> = PageResponse<T>;
export type CursorPageWire<T> = CursorPageResponse<T>;

export type UserWire = UserResponse;
export type PublicUserWire = PublicUserResponse;
export type ConsumableWire = ConsumableResponse;
export type AccountWire = AccountResponse;
export type SessionWire = SessionResponse;

export type RoleWire = Role;
export type ContributionWire = ContributionStatus;
export type MemberWire = MemberResponse;
export type ProjectSummaryWire = ProjectResponse;
export type ProjectWire = ProjectResponse;
export type ProjectCardWire = ProjectCardResponse;

export type MediaPlaceWire = PlaceResponse;
export type MediaCameraWire = CameraResponse;
export type MediaWire = MediaResponse;
export type AnalysisWire = AnalysisResponse;
export type ItemWire = ItemResponse;

export type UploadWire = UploadResponse;
export type UploadPlanWire = UploadPlanResponse;
export type UploadCompleteWire = UploadCompleteResponse;

export type LabelWire = LabelResponse;
export type ContactWire = ContactResponse;
export type ProjectInviteWire = ProjectInviteResponse;
export type AppInviteWire = AppInviteResponse;
export type DonateConsumablesWire = DonateConsumablesResponse;
export type JoinResultWire = JoinResponse;

export type SongWire = SongResponse;
export type SongWithUrlWire = SongWithUrlResponse;

export type SystemMediaItemWire = SystemMediaItem;
export type SystemMediaResponseWire = SystemMediaResponse;

export type LoginStartWire = LoginStartResponse;
export type LoginResultWire = LoginResponse;
export type DownloadLinksWire = DownloadLinksResponse;
export type AvatarStartWire = AvatarStartResponse;
export type AvatarWire = AvatarResponse;
export type SuggestionsPageWire = SuggestionsPageResponse;
