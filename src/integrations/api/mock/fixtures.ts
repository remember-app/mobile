import { Image } from 'react-native';

import type { LabelResponse } from '../contract/label';
import type { GalleryPageResponse, ItemResponse } from '../contract/media';
import type { MontageResponse, MontageTemplateResponse } from '../contract/montage';
import type { MovieResponse } from '../contract/movie';
import type { MemberResponse, ProjectCardResponse } from '../contract/project';
import type { SongResponse } from '../contract/song';
import type { AccountResponse, PublicUserResponse } from '../contract/user';

const asset = (source: number): string => {
  const resolved = Image.resolveAssetSource(source);
  return resolved?.uri ?? '';
};

const PARTY = asset(require('../../../../assets/images/mock/party.jpg'));
const WEDDING = asset(require('../../../../assets/images/mock/wedding.jpg'));
const DANCE = asset(require('../../../../assets/images/mock/dance.jpg'));
const BIRTHDAY = asset(require('../../../../assets/images/mock/birthday.jpg'));
const PICNIC = asset(require('../../../../assets/images/mock/picnic.jpg'));
const SEA = asset(require('../../../../assets/images/mock/sea.jpg'));
const FRIENDS = asset(require('../../../../assets/images/mock/friends.jpg'));
const CITY = asset(require('../../../../assets/images/mock/city.jpg'));
const VIDEO = asset(require('../../../../assets/mock/sea.mp4'));

const PHOTOS = [PARTY, WEDDING, DANCE, BIRTHDAY, PICNIC, SEA, FRIENDS, CITY];

let counter = 100;
const id = (): string => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
};

export const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';
export const MOCK_PROJECT_ID = '22222222-2222-4222-8222-222222222222';

const consumables = (tokens: number, bytes: number) => ({
  tokens: { tokens, spend: 2 },
  storage: { bytes, spend: 0 },
});

const account = (
  id: string,
  username: string,
  name: string,
  email: string,
  language: AccountResponse['language'],
): AccountResponse => ({
  id,
  username,
  name,
  email,
  language,
  registered: true,
  profileMediaId: null,
  consumables: consumables(90, 100 * 1024 ** 3),
});

export const mockAccount = account(MOCK_USER_ID, 'alice', 'Алиса', 'a@x.io', 'ru');

export const mockUsers: AccountResponse[] = [
  mockAccount,
  account('55555555-5555-4555-8555-555555555555', 'bob', 'Bob', 'b@x.io', 'en'),
  account('66666666-6666-4666-8666-666666666666', 'carol', 'Кэрол', 'c@x.io', 'ru'),
  account('77777777-7777-4777-8777-777777777777', 'dave', 'Dave', 'd@x.io', 'en'),
];

const alice: PublicUserResponse = {
  id: MOCK_USER_ID,
  username: 'alice',
  name: 'Алиса',
  profileMediaId: null,
};
const bob: PublicUserResponse = {
  id: '55555555-5555-4555-8555-555555555555',
  username: 'bob',
  name: 'Bob',
  profileMediaId: null,
};
const carol: PublicUserResponse = {
  id: '66666666-6666-4666-8666-666666666666',
  username: 'carol',
  name: 'Кэрол',
  profileMediaId: null,
};
const dave: PublicUserResponse = {
  id: '77777777-7777-4777-8777-777777777777',
  username: 'dave',
  name: 'Dave',
  profileMediaId: null,
};

const member = (
  user: PublicUserResponse,
  role: MemberResponse['role'],
  contribution: MemberResponse['contribution'],
  tokens: number,
  bytes: number,
): MemberResponse => ({
  userId: user.id,
  username: user.username,
  name: user.name,
  role,
  consumables: consumables(tokens, bytes),
  contribution,
  joinedAt: '2026-10-01T10:00:00.000Z',
  invitedBy: user.id === MOCK_USER_ID ? null : MOCK_USER_ID,
});

const label = (
  projectId: string,
  ownerId: string,
  name: string,
  colorHex: `#${string}`,
  shared: boolean,
  itemCount: number,
): LabelResponse => ({
  id: id(),
  projectId,
  ownerId,
  name,
  colorHex,
  description: null,
  shared,
  itemCount,
  createdAt: '2026-10-01T10:00:00.000Z',
});

type Kind = 'photo' | 'video' | 'audio';

const item = (
  projectId: string,
  kind: Kind,
  image: string,
  uploader: PublicUserResponse,
  options: {
    labelIds?: string[];
    description?: string;
    analyzed?: boolean;
    daysAgo?: number;
    withPlace?: boolean;
  } = {},
): ItemResponse => {
  const itemId = id();
  const mediaId = id();
  const at = new Date(Date.now() - (options.daysAgo ?? 5) * 86_400_000).toISOString();
  const description =
    options.description ??
    (kind === 'video' ? 'Волны на реке' : kind === 'audio' ? 'Первый танец, музыка' : 'Кадр');
  return {
    item: {
      id: itemId,
      projectId,
      mediaId,
      description,
      labelIds: options.labelIds ?? [],
      analysis:
        options.analyzed && kind === 'photo' ? { description: 'Тёплый момент', score: 0.8 } : null,
      createdAt: at,
    },
    media:
      kind === 'photo'
        ? {
            id: mediaId,
            fingerprint: '',
            kind: 'photo',
            format: 'jpeg',
            bytes: '287079',
            capturedAt: at,
            place: options.withPlace ? { latitude: 55.75, longitude: 37.61 } : null,
            uploadedBy: uploader.id,
            dimensions: { width: 1080, height: 1440 },
            duration: null,
            camera: null,
          }
        : kind === 'video'
          ? {
              id: mediaId,
              fingerprint: '',
              kind: 'video',
              format: 'mp4',
              bytes: '101349',
              capturedAt: at,
              place: null,
              uploadedBy: uploader.id,
              dimensions: { width: 720, height: 960 },
              duration: 5,
              camera: null,
            }
          : {
              id: mediaId,
              fingerprint: '',
              kind: 'audio',
              format: 'm4a',
              bytes: '98823',
              capturedAt: at,
              place: null,
              uploadedBy: uploader.id,
              dimensions: null,
              duration: 8,
              camera: null,
            },
    uploader,
    links: { original: image, thumbnail: image, preview: image },
  };
};

type Stage = 'analysis' | 'preparation' | 'directing' | 'editing' | 'done' | 'failed';

const manifest = (
  shots: ItemResponse[],
  targetSeconds: number,
  prompt: string | null,
  stage: Stage,
) => {
  const config = {
    targetSeconds,
    prompt,
    dimensions: { width: 1080, height: 1920 },
    musicIds: [] as string[],
    includeItemIds: shots.map((one) => one.item.id),
    requiredItemIds: [] as string[],
    templateId: null,
    name: null as string | null,
  };
  const report = {
    movie: {
      targetSeconds,
      dimensions: { width: 1080, height: 1920 },
      story: prompt,
      requiredItemIds: [],
    },
    shots: shots.map((one) => ({
      itemId: one.item.id,
      mediaId: one.item.mediaId,
      kind: one.media.kind,
      capturedAt: one.media.capturedAt,
      width: one.media.dimensions?.width ?? null,
      height: one.media.dimensions?.height ?? null,
      durationSeconds: one.media.duration,
      hasAudio: one.media.kind !== 'photo',
      shownWithCover: one.media.kind === 'audio',
      description: one.item.description,
      labels: [],
      analysis: one.item.analysis,
    })),
    music: [],
  };
  const commands = shots.map((one) => ({
    type: 'shot',
    itemId: one.item.id,
    mediaId: one.item.mediaId,
    kind: one.media.kind,
    sourceStartSeconds: 0,
    seconds: 2.5,
    liveLevel: 0,
    framing: null,
    motion: 'none',
    transitionSeconds: 0.25,
  }));
  const planned = stage !== 'analysis' && stage !== 'preparation' && stage !== 'directing';
  return {
    preparationConfig: config,
    directingInput:
      stage === 'analysis' || stage === 'preparation' ? null : { mergedMontageData: report },
    editingParams: planned ? { commands } : null,
  };
};

const montage = (
  projectId: string,
  shots: ItemResponse[],
  stage: Stage,
  targetSeconds: number,
  prompt: string | null,
): MontageResponse => ({
  id: id(),
  projectId,
  createdBy: MOCK_USER_ID,
  status:
    stage === 'analysis'
      ? 'queued'
      : stage === 'done'
        ? 'done'
        : stage === 'failed'
          ? 'failed'
          : 'processing',
  manifest: manifest(shots, targetSeconds, prompt, stage),
  createdAt: '2026-10-22T10:00:00.000Z',
  error: stage === 'failed' ? 'The model could not agree on a plan for these shots.' : null,
  journal: {
    directing:
      stage === 'analysis' || stage === 'preparation' || stage === 'directing'
        ? null
        : {
            text: `The movie is built from ${shots.length} shots, with a calm pace and space for every moment.`,
            usedItemIds: shots.map((one) => one.item.id),
          },
  },
});

const movie = (
  projectId: string,
  montageResponse: MontageResponse,
  name: string,
  poster: string | null,
  createdAt: string,
): MovieResponse => ({
  id: id(),
  name,
  projectId,
  createdBy: MOCK_USER_ID,
  createdAt,
  montageId: montageResponse.id,
  videoId: id(),
  video: {
    durationSeconds: 12.05,
    bytes: 1634374,
    width: 1080,
    height: 1920,
    format: 'mp4',
  },
  montage: montageResponse,
  derived: { thumbnailId: null, previewId: null },
  video_url: VIDEO,
  poster_url: poster,
  preview_url: VIDEO,
});

type Bundle = {
  project: ProjectCardResponse;
  members: MemberResponse[];
  labels: LabelResponse[];
  gallery: GalleryPageResponse;
  montages: MontageResponse[];
  movies: MovieResponse[];
};

const bundle = (
  project: ProjectCardResponse,
  members: MemberResponse[],
  labels: LabelResponse[],
  items: ItemResponse[],
  montages: MontageResponse[],
  movies: MovieResponse[],
): Bundle => ({
  project,
  members,
  labels,
  gallery: { items, nextCursor: null },
  montages,
  movies,
});

const weddingId = MOCK_PROJECT_ID;
const cover = label(weddingId, alice.id, 'Обложка', '#e8b04b', true, 2);
const favourite = label(weddingId, alice.id, 'Любимое', '#ec4899', false, 1);
const weddingItems = [
  item(weddingId, 'photo', PARTY, alice, {
    labelIds: [cover.id, favourite.id],
    analyzed: true,
    withPlace: true,
  }),
  item(weddingId, 'photo', WEDDING, bob, { labelIds: [cover.id], analyzed: true }),
  item(weddingId, 'photo', DANCE, carol, { analyzed: true }),
  item(weddingId, 'photo', BIRTHDAY, alice, { analyzed: true, withPlace: true }),
  item(weddingId, 'video', SEA, bob),
  item(weddingId, 'audio', DANCE, alice),
];
const weddingMontage = montage(
  weddingId,
  weddingItems,
  'done',
  30,
  'Тёплый фильм о первом танце и гостях',
);
const TRACK_MEDIA = '12121212-1212-4212-8212-121212121212';
const weddingConfig = weddingMontage.manifest.preparationConfig;
if (weddingConfig) weddingConfig.musicIds = [TRACK_MEDIA];
const weddingReport = weddingMontage.manifest.directingInput?.mergedMontageData as
  | { music?: unknown[] }
  | undefined;
if (weddingReport) {
  weddingReport.music = [
    {
      songId: '13131313-1313-4313-8313-131313131313',
      mediaId: TRACK_MEDIA,
      name: 'Тихий вечер',
      author: 'Nox',
      durationSeconds: 30,
      analysis: null,
    },
  ];
}
const weddingMovie = movie(weddingId, weddingMontage, 'Свадьба', SEA, '2026-10-22T10:05:00.000Z');

const emptyId = '22222222-2222-4222-8222-222222222223';
const emptyProject: ProjectCardResponse = {
  id: emptyId,
  title: 'Пустая папка',
  eventStart: '2026-11-01T10:00:00.000Z',
  eventEnd: null,
  consumables: consumables(10, 1024 ** 3),
  itemCount: 0,
  memberCount: 1,
  sharedCount: 0,
  myRole: 'admin',
  myContribution: 'not_started',
  previewUrls: [],
};

const partyId = '22222222-2222-4222-8222-222222222224';
const partyCover = label(partyId, alice.id, 'Обложка', '#84cc16', true, 3);
const partyItems = Array.from({ length: 9 }, (_, index) =>
  item(partyId, 'photo', PHOTOS[index % PHOTOS.length] ?? PARTY, index % 2 === 0 ? alice : bob, {
    labelIds: index < 3 ? [partyCover.id] : [],
    analyzed: index % 3 !== 0,
    description: `Кадр ${index + 1}`,
  }),
);
const partyDirecting = montage(partyId, partyItems, 'directing', 25, 'Короткий клип про вечер');
const partyFailed = montage(partyId, partyItems.slice(0, 4), 'failed', 20, null);
const partyProject: ProjectCardResponse = {
  id: partyId,
  title: 'Корпоратив',
  eventStart: '2026-10-10T18:00:00.000Z',
  eventEnd: '2026-10-11T01:00:00.000Z',
  consumables: consumables(25, 3 * 1024 ** 3),
  itemCount: partyItems.length,
  memberCount: 4,
  sharedCount: 3,
  myRole: 'admin',
  myContribution: 'done',
  previewUrls: PHOTOS.slice(0, 4),
};

const concertId = '22222222-2222-4222-8222-222222222225';
const concertCover = label(concertId, carol.id, 'Обложка', '#a855f7', true, 1);
const concertItems = [
  item(concertId, 'photo', DANCE, carol, { labelIds: [concertCover.id], analyzed: true }),
  item(concertId, 'photo', CITY, carol, { analyzed: true }),
  item(concertId, 'photo', FRIENDS, alice, { analyzed: true }),
];
const concertMontage = montage(concertId, concertItems, 'analysis', 15, null);
const concertProject: ProjectCardResponse = {
  id: concertId,
  title: 'Концерт',
  eventStart: '2026-11-08T20:00:00.000Z',
  eventEnd: null,
  consumables: consumables(5, 512 * 1024 ** 2),
  itemCount: concertItems.length,
  memberCount: 2,
  sharedCount: 1,
  myRole: 'contributor',
  myContribution: 'more_coming',
  previewUrls: [DANCE, CITY, FRIENDS],
};

const dachaId = '22222222-2222-4222-8222-222222222226';
const dachaCover = label(dachaId, bob.id, 'Обложка', '#3b82f6', true, 2);
const dachaItems = [
  item(dachaId, 'photo', PICNIC, bob, { labelIds: [dachaCover.id], analyzed: true }),
  item(dachaId, 'photo', SEA, bob, { labelIds: [dachaCover.id], analyzed: true }),
  item(dachaId, 'photo', FRIENDS, alice, { analyzed: true }),
  item(dachaId, 'video', SEA, dave),
];
const dachaMontage = montage(dachaId, dachaItems, 'done', 20, null);
const dachaMovie = movie(dachaId, dachaMontage, 'Дача', PICNIC, '2026-11-02T18:00:00.000Z');
const dachaSecond = montage(dachaId, dachaItems.slice(0, 2), 'done', 10, 'Только вода и еда');
const dachaSecondMovie = movie(
  dachaId,
  dachaSecond,
  'Дача, короткая версия',
  SEA,
  '2026-11-03T09:00:00.000Z',
);
const dachaProject: ProjectCardResponse = {
  id: dachaId,
  title: 'Дача',
  eventStart: '2026-10-30T12:00:00.000Z',
  eventEnd: '2026-10-31T12:00:00.000Z',
  consumables: consumables(30, 2 * 1024 ** 3),
  itemCount: dachaItems.length,
  memberCount: 3,
  sharedCount: 2,
  myRole: 'contributor',
  myContribution: 'more_coming',
  previewUrls: [PICNIC, SEA, FRIENDS],
};

const weddingMembers = [
  member(alice, 'admin', 'done', 40, 4 * 1024 ** 3),
  member(bob, 'contributor', 'more_coming', 20, 2 * 1024 ** 3),
  member(carol, 'viewer', 'not_started', 0, 0),
];

const weddingProject: ProjectCardResponse = {
  id: weddingId,
  title: 'Свадьба',
  eventStart: '2026-10-20T15:00:00.000Z',
  eventEnd: '2026-10-21T02:00:00.000Z',
  consumables: consumables(40, 4 * 1024 ** 3),
  itemCount: weddingItems.length,
  memberCount: 3,
  sharedCount: 2,
  myRole: 'admin',
  myContribution: 'done',
  previewUrls: [PARTY, WEDDING, DANCE, BIRTHDAY],
};

export const mockProjects: ProjectCardResponse[] = [
  weddingProject,
  partyProject,
  concertProject,
  dachaProject,
  emptyProject,
];

export const mockBundles: Record<string, Bundle> = {
  [weddingId]: bundle(
    weddingProject,
    weddingMembers,
    [cover, favourite],
    weddingItems,
    [weddingMontage],
    [weddingMovie],
  ),
  [partyId]: bundle(
    partyProject,
    [
      member(alice, 'admin', 'done', 25, 3 * 1024 ** 3),
      member(bob, 'contributor', 'done', 10, 1024 ** 3),
      member(carol, 'contributor', 'more_coming', 5, 512 * 1024 ** 2),
      member(dave, 'viewer', 'not_started', 0, 0),
    ],
    [partyCover],
    partyItems,
    [partyDirecting, partyFailed],
    [],
  ),
  [concertId]: bundle(
    concertProject,
    [
      member(carol, 'admin', 'done', 20, 1024 ** 3),
      member(alice, 'contributor', 'more_coming', 5, 512 * 1024 ** 2),
    ],
    [concertCover],
    concertItems,
    [concertMontage],
    [],
  ),
  [dachaId]: bundle(
    dachaProject,
    [
      member(bob, 'admin', 'done', 30, 2 * 1024 ** 3),
      member(alice, 'contributor', 'done', 10, 1024 ** 3),
      member(dave, 'viewer', 'not_started', 0, 0),
    ],
    [dachaCover],
    dachaItems,
    [dachaMontage, dachaSecond],
    [dachaMovie, dachaSecondMovie],
  ),
  [emptyId]: bundle(
    emptyProject,
    [member(alice, 'admin', 'not_started', 10, 1024 ** 3)],
    [],
    [],
    [],
    [],
  ),
};

export const mockTemplates: MontageTemplateResponse[] = [
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01',
    name: 'Быстрый клип',
    settings: {
      targetSeconds: 15,
      prompt: 'Короткий динамичный клип о самом ярком моменте.',
      dimensions: { width: 1080, height: 1920 },
      musicIds: [],
    },
    coverId: null,
    description: null,
    referenceMediaId: null,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02',
    name: 'Кино',
    settings: {
      targetSeconds: 60,
      prompt: 'Тёплый фильм с историей, спокойным ритмом и титрами.',
      dimensions: { width: 1080, height: 1920 },
      musicIds: [],
    },
    coverId: null,
    description: null,
    referenceMediaId: null,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03',
    name: 'Репортаж',
    settings: {
      targetSeconds: 45,
      prompt: 'Репортаж о том, как прошёл день, от начала до конца.',
      dimensions: { width: 1920, height: 1080 },
      musicIds: [],
    },
    coverId: null,
    description: null,
    referenceMediaId: null,
  },
];

export const mockSongs: SongResponse[] = [
  {
    id: '14141414-1414-4414-8414-141414141414',
    name: 'Тихий вечер',
    author: 'Nox',
    mediaId: TRACK_MEDIA,
    coverId: null,
    description: null,
    projectId: null,
    uploadedBy: null,
  },
  {
    id: '15151515-1515-4515-8515-151515151515',
    name: 'Праздник',
    author: 'Nox',
    mediaId: '16161616-1616-4616-8616-161616161616',
    coverId: null,
    description: null,
    projectId: null,
    uploadedBy: null,
  },
];

export function createMockMontage(
  projectId: string,
  config: {
    targetSeconds: number;
    prompt: string | null;
    dimensions: { width: number; height: number };
    musicIds: string[];
    includeItemIds: string[];
  },
  name: string | null,
): MontageResponse | undefined {
  const found = mockBundles[projectId];
  if (!found) return undefined;
  const chosen = config.includeItemIds.flatMap((itemId) =>
    found.gallery.items.filter((one) => one.item.id === itemId).slice(0, 1),
  );
  if (chosen.length === 0) return undefined;
  const made = montage(projectId, chosen, 'done', config.targetSeconds, config.prompt);
  const settings = made.manifest.preparationConfig;
  if (settings) {
    settings.dimensions = config.dimensions;
    settings.musicIds = config.musicIds;
    settings.name = name;
  }
  const film = movie(
    projectId,
    made,
    name || found.project.title,
    chosen[0]?.links.thumbnail ?? null,
    new Date().toISOString(),
  );
  found.montages.unshift(made);
  found.movies.unshift(film);
  return made;
}
