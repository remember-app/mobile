import { expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { account, datesRefusal, languageRefusal, orderRefusal } from '@tests/helpers/contract';
import { deleteMemory, type MontageTemplate, putDatesBetweenDays } from '@/api';
import {
  blankOrder,
  fromTemplate,
  type Order,
  type PickedTrack,
  wishes,
} from '@/lib/montage/order';

/**
 * The seam between this app and the real api, on the three routes m-28 moved: what the stand-ins in
 * every other test accept is what `projects/api/docs` says the api accepts — and what the app really
 * puts on the wire is inside that. So the two halves are pinned here: the shared stand-in refuses what
 * the api refuses, and every order the wizard can build, every switch of the account and every delete
 * is one the stand-in takes.
 */

const status = (refusal: Response | null) => refusal?.status ?? 200;

test('the stand-in refuses every body the docs say the api refuses, and takes the docs’ own example', () => {
  // `docs/montages.md`, the request as written there.
  expect(
    orderRefusal({
      target_seconds: 90,
      story_text: 'Как мы ехали на дачу',
      include_media_ids: ['8f1c'],
      exclude_media_ids: ['3ab0'],
      music_tracks: ['music/7d2e', 'calm'],
      music_wishes: { 'music/7d2e': 'На сборы, тихо' },
      orientation: 'portrait',
    }),
  ).toBeNull();
  // «Без пожеланий» in its three shapes; the third is a request with no body at all.
  for (const nothing of [null, {}]) expect(orderRefusal(nothing)).toBeNull();

  const refused: [string, unknown][] = [
    [
      'a wish to a track the order does not play',
      { music_tracks: ['calm'], music_wishes: { warm: 'x' } },
    ],
    ['a wish with no tracks at all', { music_wishes: { calm: 'x' } }],
    [
      'a wish over 500 characters',
      { music_tracks: ['calm'], music_wishes: { calm: 'я'.repeat(501) } },
    ],
    [
      '500 letters and a trailing space (the limit is on what was sent)',
      { music_tracks: ['calm'], music_wishes: { calm: `${'я'.repeat(500)} ` } },
    ],
    ['one track twice', { music_tracks: ['calm', 'calm'] }],
    [
      'more than fifty tracks',
      { music_tracks: Array.from({ length: 51 }, (_, i) => `music/${i}`) },
    ],
    ['a track that is neither on the shelf nor a key', { music_tracks: ['jazz'] }],
    ['the old one-track fields', { music_track_id: 'calm' }],
    ['the old one-track fields, by key', { music_track_key: 'music/1' }],
    ['a length that is not whole', { target_seconds: 60.5 }],
    ['a length as text', { target_seconds: '60' }],
    ['a story over 2000 characters', { story_text: 'я'.repeat(2001) }],
    ['a direction the worker has no canvas for', { orientation: 'square' }],
    ['the same frame in a list twice', { exclude_media_ids: ['a', 'a'] }],
    ['wishes as a list', { music_tracks: ['calm'], music_wishes: ['x'] }],
    // Not the api's 400 but stricter on purpose: the api would drop it and the wish would be lost.
    ['the one line for the whole order the api no longer reads', { music_note: 'x' }],
  ];
  for (const [what, body] of refused) expect(status(orderRefusal(body)), what).toBe(400);

  // The edges that are fine: exactly 500 (the api counts letters, not bytes), a blank wish (dropped
  // there as «не сказали»), 50 tracks, and a wish under a key that is the track's own.
  expect(
    orderRefusal({ music_tracks: ['calm'], music_wishes: { calm: 'я'.repeat(500) } }),
  ).toBeNull();
  expect(orderRefusal({ music_tracks: ['calm'], music_wishes: { calm: '   ' } })).toBeNull();
  expect(
    orderRefusal({ music_tracks: Array.from({ length: 50 }, (_, i) => `music/${i}`) }),
  ).toBeNull();
});

test('the account setting takes only the JSON boolean under its one name', () => {
  for (const ok of [true, false]) expect(datesRefusal({ dates_between_days: ok })).toBeNull();
  for (const body of [
    null,
    {},
    { dates_between_days: 'true' },
    { dates_between_days: 1 },
    { dates_between_days: null },
    { datesBetweenDays: true },
    { dates_between_days: true, language: 'ru' },
    [true],
  ])
    expect(status(datesRefusal(body)), JSON.stringify(body)).toBe(400);
});

test('the language switch takes exactly ru or en', () => {
  for (const ok of ['ru', 'en']) expect(languageRefusal({ language: ok })).toBeNull();
  for (const body of [
    null,
    {},
    { language: 'de' },
    { language: 'ru-RU' },
    { lang: 'ru' },
    { language: 'ru', x: 1 },
  ])
    expect(status(languageRefusal(body)), JSON.stringify(body)).toBe(400);
});

const key = (name: string, wish?: string): PickedTrack => ({ key: name, name: null, wish });
const own = (uuid: string, wish?: string): PickedTrack => ({
  key: `music/${uuid}`,
  name: 'song.mp3',
  wish,
});
const order = (over: Partial<Order>): Order => ({ ...blankOrder(), ...over });

test('every order the wizard can build is one the api takes', () => {
  const tired = 'я'.repeat(500);
  const orders: [string, Order][] = [
    ['nothing said', blankOrder()],
    [
      'no music, a story and a length',
      order({ story: '  Сборы  ', seconds: 137, orientation: 'portrait' }),
    ],
    [
      'a wish at the field’s own limit, spaces round it',
      order({ tracks: [key('calm', ` ${tired.slice(1)} `)] }),
    ],
    ['a wish written and wiped', order({ tracks: [key('calm', '   '), key('warm', '')] })],
    [
      'a wish in a language of letters and pictures',
      order({ tracks: [key('bright', 'Бодро 🎉🎉 и 東京')] }),
    ],
    [
      'the whole shelf, each with a wish',
      order({
        tracks: ['bright', 'warm', 'calm', 'night', 'road'].map((id) => key(id, `про ${id}`)),
      }),
    ],
    [
      'a shelf track and two of their own, in a mixed order',
      order({ tracks: [own('7d2e', 'Первым'), key('calm'), own('9c1d', 'На танец')] }),
    ],
  ];
  for (const [what, one] of orders) {
    const body = wishes([], one);
    expect(status(orderRefusal(body)), what).toBe(200);
    // Whatever the wizard held, nothing empty goes out under `music_wishes` and only tracks of the order stand in it.
    for (const [track, wish] of Object.entries(body.music_wishes ?? {})) {
      expect(wish, what).not.toBe('');
      expect(body.music_tracks, what).toContain(track);
    }
  }
});

/** The six as the api hands them out: the two with wishes have one per track, the rest `{}`. */
const template = (
  id: MontageTemplate['id'],
  tracks: string[],
  said: Record<string, string> = {},
): MontageTemplate => ({
  id,
  story_text: 'История',
  target_seconds: 45,
  orientation: 'landscape',
  music_tracks: tracks,
  music_wishes: said,
});

test('a template’s own wishes go out under its tracks — two for «Дофаминовая бомба» — and pass', () => {
  const dopamine = template('dopamine', ['bright', 'road'], { bright: 'Первым', road: 'Вторым' });
  const filled = { ...blankOrder(), ...fromTemplate(dopamine) };
  expect(wishes([], filled)).toMatchObject({
    music_tracks: ['bright', 'road'],
    music_wishes: { bright: 'Первым', road: 'Вторым' },
  });
  for (const one of [
    dopamine,
    template('parents', ['warm'], { warm: 'Мягко' }),
    template('quick', ['bright']),
    // The api never says this, but an app must not turn it into a 400: a wish for a track not played.
    template('report', ['calm'], { road: 'лишнее' }),
  ])
    expect(
      status(orderRefusal(wishes([], { ...blankOrder(), ...fromTemplate(one) }))),
      one.id,
    ).toBe(200);
});

test('the client puts the switch on the wire the way the api reads it, and the delete with no body and no JSON header', async () => {
  const sent: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return new Response(JSON.stringify(init.method === 'DELETE' ? { ok: true } : account()), {
      status: 200,
    });
  });
  try {
    await putDatesBetweenDays('t', true);
    await putDatesBetweenDays('t', false);
    await deleteMemory('t', 'm1');
  } finally {
    vi.unstubAllGlobals();
  }
  const [on, off, gone] = sent;
  for (const [call, wanted] of [
    [on, true],
    [off, false],
  ] as const) {
    expect(call.init.method).toBe('POST');
    expect(call.url).toMatch(/\/me\/dates-between-days$/);
    expect(JSON.parse(String(call.init.body))).toEqual({ dates_between_days: wanted });
    expect(datesRefusal(JSON.parse(String(call.init.body)))).toBeNull();
    expect(call.init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer t',
    });
  }
  // `DELETE /memories/:id` (docs/memories.md): a JSON header over an empty body is Fastify's 400.
  expect(gone.init.method).toBe('DELETE');
  expect(gone.url).toMatch(/\/memories\/m1$/);
  expect(gone.init.body).toBeUndefined();
  expect(gone.init.headers).not.toHaveProperty('Content-Type');
});
