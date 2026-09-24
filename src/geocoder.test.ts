import { reverseGeocodeAsync } from 'expo-location';
import { beforeEach, expect, test, vi } from 'vitest';

// The phone's geocoder, with the answers the test hands it and a count of how often it was asked.
vi.mock('expo-location', () => ({ reverseGeocodeAsync: vi.fn() }));

import { nameOfPlace } from '@/geocoder';
import geocoder from './geocoder.ts?raw';

/**
 * What the frame's sheet does about a place (`SheetFrameInfo`, «Место»): asks the phone for the
 * name of a point, and asks once. Every test uses a point of its own, because the answers are kept
 * for as long as the app lives — which is the thing being tested, and so cannot be reset between.
 */

const geocode = vi.mocked(reverseGeocodeAsync);

const manor = [{ name: 'Усадьба «Остафьево»', city: 'Москва' }] as never;

// Every way the app could say anything, heard and silenced.
const talk = Object.fromEntries(
  (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) => [
    level,
    vi.spyOn(console, level).mockImplementation(() => {}),
  ]),
);

beforeEach(() => {
  geocode.mockReset();
  for (const spy of Object.values(talk)) spy.mockClear();
});

/** Everything the app said to any console, as one string. */
const said = () =>
  Object.values(talk)
    .flatMap((spy) => spy.mock.calls.flat())
    .map(String)
    .join(' ');

test('a point is named by what the geocoder answers, asked for exactly that point', async () => {
  geocode.mockResolvedValueOnce(manor);
  await expect(nameOfPlace(55.518, 37.53)).resolves.toBe('Усадьба «Остафьево», Москва');
  expect(geocode).toHaveBeenCalledExactlyOnceWith({ latitude: 55.518, longitude: 37.53 });
});

test('the same point is asked once, however many times the sheet is opened', async () => {
  geocode.mockResolvedValueOnce(manor);
  // Two opens while the first is still in the air, then two more once it has come back.
  const first = nameOfPlace(1.1, 2.2);
  const second = nameOfPlace(1.1, 2.2);
  expect(await first).toBe(await second);
  expect(await nameOfPlace(1.1, 2.2)).toBe('Усадьба «Остафьево», Москва');
  expect(await nameOfPlace(1.1, 2.2)).toBe('Усадьба «Остафьево», Москва');
  expect(geocode).toHaveBeenCalledTimes(1);
});

test('a point that could not be named is not asked about again either', async () => {
  // Empty, and fallen over: both are «no name», and both are kept.
  geocode.mockResolvedValueOnce([]);
  await expect(nameOfPlace(3.1, 3.2)).resolves.toBeNull();
  await expect(nameOfPlace(3.1, 3.2)).resolves.toBeNull();
  expect(geocode).toHaveBeenCalledTimes(1);

  geocode.mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'ERR_GEOCODE' }));
  await expect(nameOfPlace(4.1, 4.2)).resolves.toBeNull();
  await expect(nameOfPlace(4.1, 4.2)).resolves.toBeNull();
  expect(geocode).toHaveBeenCalledTimes(2);
});

test('a geocoder that is missing, blocked or not answering never throws into the sheet', async () => {
  // No permission (Android), no service, a throw before there is even a promise, an answer with
  // nothing in it, or with rubbish where the addresses should be.
  geocode.mockRejectedValueOnce(undefined);
  await expect(nameOfPlace(5.1, 5.2)).resolves.toBeNull();
  geocode.mockImplementationOnce(() => {
    throw new Error('not linked');
  });
  await expect(nameOfPlace(5.3, 5.4)).resolves.toBeNull();
  geocode.mockResolvedValueOnce([{}] as never);
  await expect(nameOfPlace(5.5, 5.6)).resolves.toBeNull();
  geocode.mockResolvedValueOnce(undefined as never);
  await expect(nameOfPlace(5.7, 5.8)).resolves.toBeNull();
});

test('each point keeps its own answer, whichever comes back first', async () => {
  let answerA: (answer: unknown) => void = () => {};
  geocode.mockReturnValueOnce(new Promise((resolve) => (answerA = resolve)) as never);
  geocode.mockResolvedValueOnce([{ city: 'Казань' }] as never);

  const a = nameOfPlace(6.1, 6.2);
  const b = nameOfPlace(6.3, 6.4);
  expect(await b).toBe('Казань');
  answerA([{ city: 'Москва' }]);
  // The late one lands on its own point and on no other.
  expect(await a).toBe('Москва');
  expect(await nameOfPlace(6.3, 6.4)).toBe('Казань');
  expect(geocode).toHaveBeenCalledTimes(2);
});

test('neither the point nor its name reaches a log — on an answer, or on a failure', async () => {
  geocode.mockResolvedValueOnce(manor);
  await nameOfPlace(55.7601234, 37.6187654);
  geocode.mockRejectedValueOnce(
    Object.assign(new Error('failed at 55.7691234, 37.6287654 near Остафьево'), {
      code: 'ERR_GEOCODE',
    }),
  );
  await nameOfPlace(55.7691234, 37.6287654);

  const out = said();
  for (const secret of ['55.76', '37.61', '37.62', 'Остафьево', 'Москва']) {
    expect(out).not.toContain(secret);
  }
  // The failure is still heard: by its code, and by nothing that came with it.
  expect(out).toContain('ERR_GEOCODE');
});

test('the sheet holds the answer with its point, so a late one cannot land on another frame', () => {
  // The hook cannot be rendered here (no renderer, and the effect is what is in question), so this
  // pins its two halves as text — the way `memory-screens.test.ts` pins the sheet's own read:
  // an answer that arrives after its frame was left is dropped, and one that does get in is only
  // handed back while the point it was for is still the one being asked about.
  expect(geocoder).toContain('if (current) setFound({ key: keyOf(latitude, longitude), name });');
  expect(geocoder).toContain('return found?.key === key ? found.name : null;');
});
