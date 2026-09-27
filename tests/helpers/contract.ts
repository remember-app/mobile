/**
 * What the real api takes, written once for every stand-in server that answers these routes — so a
 * test cannot go green on a body the api would turn away, or on one it would take and quietly
 * throw a part of away. Read off the api's own docs (`projects/api/docs/montages.md`, `auth.md`) and
 * its schema (`src/montages/order.ts`); when one of them moves, this moves with it and every stand-in
 * follows. Imported by `*.test.*` and by the stand-ins in this folder only.
 */

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status });

/** The 400 of a body that fails the api's schema: the words are Fastify's, the status is what counts. */
const schema = (why: string) => json({ statusCode: 400, error: 'Bad Request', message: why }, 400);

/** The five tracks of the worker's own shelf (`docs/music.md`); anything else is a key off a phone. */
const SHELF = ['bright', 'warm', 'calm', 'night', 'road'];

const KNOWN = [
  'target_seconds',
  'story_text',
  'include_media_ids',
  'exclude_media_ids',
  'music_tracks',
  'music_wishes',
  'orientation',
  // Not the worker's: the film keeps them in columns of their own (`src/montages/order.ts`).
  'name',
  'template',
];

/** The six templates by the api's own ids (`src/montages/row.ts`, `templateIds`). */
const TEMPLATES = ['for_myself', 'quick', 'report', 'short_form', 'parents', 'dopamine'];

const isList = (value: unknown, item: (one: unknown) => boolean): value is unknown[] =>
  Array.isArray(value) && value.every(item);
const isText = (value: unknown, most: number): value is string =>
  typeof value === 'string' && [...value].length <= most;
const distinct = (list: unknown[]) => new Set(list).size === list.length;

/**
 * `POST /memories/:id/montages` and `…/preview`, as far as the body goes: the refusal the api answers
 * with, or `null` when it takes the body. What only the database can judge — which own-track keys
 * exist, which frames are ready, the band of the length — stays with the stand-in that has material.
 *
 * Stricter than the api in exactly one place, on purpose: a field the api does not know it drops
 * without a word (`removeAdditional`), which is how a wish sent under the wrong name would vanish
 * from the film and from every test. Here it is a 400 with the name of the field.
 */
export function orderRefusal(body: unknown): Response | null {
  if (body === null) return null;
  if (typeof body !== 'object' || Array.isArray(body)) return schema('body must be object or null');
  const order = body as Record<string, unknown>;

  // Refused outright by the api: a client still naming one track the old way would get no music.
  for (const gone of ['music_track_id', 'music_track_key'])
    if (gone in order) return schema(`body/${gone} is not allowed`);
  const strange = Object.keys(order).filter((key) => !KNOWN.includes(key));
  if (strange.length > 0) return schema(`the api would drop ${strange.join(', ')} without a word`);

  if ('target_seconds' in order && !Number.isInteger(order.target_seconds))
    return schema('body/target_seconds must be integer');
  if ('story_text' in order && !isText(order.story_text, 2000))
    return schema('body/story_text must be a string of at most 2000 characters');
  for (const key of ['include_media_ids', 'exclude_media_ids'])
    if (
      key in order &&
      !(isList(order[key], (id) => typeof id === 'string') && distinct(order[key] as unknown[]))
    )
      return schema(`body/${key} must be a list of distinct ids`);
  if (
    'orientation' in order &&
    order.orientation !== 'landscape' &&
    order.orientation !== 'portrait'
  )
    return schema('body/orientation must be equal to one of the allowed values');
  if ('name' in order && !isText(order.name, 200))
    return schema('body/name must be a string of at most 200 characters');
  if ('template' in order && !TEMPLATES.includes(order.template as string))
    return schema('body/template must be equal to one of the allowed values');

  const tracks = order.music_tracks;
  if ('music_tracks' in order) {
    if (!isList(tracks, (one) => isText(one, 200)))
      return schema('body/music_tracks must be a list of strings of at most 200 characters');
    if (tracks.length > 50) return schema('body/music_tracks must NOT have more than 50 items');
    if (!distinct(tracks)) return schema('body/music_tracks must NOT have duplicate items');
    // Not on the shelf and not a key off a phone: «no such music track», named.
    const unknown = tracks.filter(
      (one) => !SHELF.includes(one as string) && !String(one).startsWith('music/'),
    );
    if (unknown.length > 0)
      return json({ error: 'no such music track', music_tracks: unknown }, 400);
  }

  if ('music_wishes' in order) {
    const wishes = order.music_wishes;
    if (typeof wishes !== 'object' || wishes === null || Array.isArray(wishes))
      return schema('body/music_wishes must be object');
    const said = Object.entries(wishes as Record<string, unknown>);
    // The limit is on what was sent, before it is trimmed: 500 letters and a trailing space fail.
    if (said.some(([, wish]) => !isText(wish, 500)))
      return schema('body/music_wishes/<track> must be a string of at most 500 characters');
    // A blank one is «не сказали» and is dropped; any other is about a track, and the track has to be in the order.
    const astray = said
      .filter(([, wish]) => (wish as string).trim() !== '')
      .map(([track]) => track)
      .filter((track) => !(Array.isArray(tracks) && tracks.includes(track)));
    if (astray.length > 0)
      return json(
        { error: 'music wish for a track not in music_tracks', music_wishes: astray },
        400,
      );
  }
  return null;
}

/**
 * `POST /me/dates-between-days`: only the JSON `true` or `false` under that one name — not `"true"`,
 * `1`, `null`, and not the camel-cased name. Fastify would quietly coerce the first ones by default,
 * and the api's schema goes out of its way not to let it.
 */
export function datesRefusal(body: unknown): Response | null {
  const ok =
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    typeof (body as Record<string, unknown>).dates_between_days === 'boolean' &&
    Object.keys(body).length === 1;
  return ok ? null : schema('body must be {"dates_between_days": boolean}');
}

/** `POST /me/language`: exactly one of the two languages there are (doc-8) under `language`, nothing else. */
export function languageRefusal(body: unknown): Response | null {
  const ok =
    typeof body === 'object' &&
    body !== null &&
    Object.keys(body).length === 1 &&
    ['ru', 'en'].includes((body as Record<string, unknown>).language as string);
  return ok ? null : schema('body must be {"language": "ru" | "en"}');
}

/**
 * The person as every api answer that carries one hands them out — `GET /me`, the sign-ins and the
 * two settings — the six fields of `docs/auth.md` and nothing else. A setting changed answers with
 * the whole account, not with the setting.
 */
export const account = (
  over: Partial<{
    id: string;
    username: string | null;
    name: string | null;
    email: string | null;
    language: 'ru' | 'en';
    dates_between_days: boolean;
  }> = {},
) => ({
  id: 'me',
  username: 'liza',
  name: 'Лиза Морозова',
  email: 'liza@example.com',
  language: 'ru' as const,
  dates_between_days: false,
  ...over,
});
