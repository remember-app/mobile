import { reverseGeocodeAsync } from 'expo-location';
import { beforeEach, expect, test, vi } from 'vitest';

// The phone's geocoder, with the answers the test hands it and a count of how often it was asked.
vi.mock('expo-location', () => ({ reverseGeocodeAsync: vi.fn() }));

import TestRenderer, { act } from 'react-test-renderer';

import { usePlaceName } from '@/geocoder';
import { later } from '@/test-api';
import { mounted, mountsTrees } from '@/test-renderer';

/**
 * What the frame's sheet reads a place through (`usePlaceName`): `null` until the phone has named the
 * point and for good when it has not, and never the name of a point that is no longer the one being
 * asked about. The sheet stays mounted from one frame to the next, so the hook is rendered here the
 * way the sheet renders it — `geocoder.test.ts` has the asking, the caching and the log.
 *
 * Every test takes points of its own: what the phone said about a point is kept for as long as the
 * app lives, which is the thing `geocoder.test.ts` proves and cannot be reset between.
 */

mountsTrees();

const geocode = vi.mocked(reverseGeocodeAsync);
beforeEach(() => {
  geocode.mockReset();
});

type Point = { latitude?: number | null; longitude?: number | null };

/** A component that does nothing but read the hook, and a way to say which point it is on. */
async function probe(start: Point) {
  const seen: (string | null)[] = [];
  function Probe(point: Point) {
    seen.push(usePlaceName(point.latitude, point.longitude));
    return null;
  }
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(<Probe {...start} />));
  });
  return {
    /** What the hook says now. */
    now: () => seen.at(-1),
    /** Every answer it has given, in order. */
    all: () => seen,
    move: (point: Point) => act(async () => tree.update(<Probe {...point} />)),
    unmount: () => act(async () => tree.unmount()),
  };
}

test('with no point — or half of one — the phone is not asked and the name is nothing', async () => {
  for (const point of [{}, { latitude: null, longitude: null }, { latitude: 1, longitude: null }, { latitude: null, longitude: 2 }, { latitude: 1 }, { longitude: 2 }]) {
    const place = await probe(point);
    expect(place.now(), JSON.stringify(point)).toBeNull();
  }
  expect(geocode).not.toHaveBeenCalled();
});

test('the name is nothing until the phone has answered, and then it is what the phone said', async () => {
  const answer = later<unknown>();
  geocode.mockReturnValueOnce(answer.promise as never);
  const place = await probe({ latitude: 10.1, longitude: 20.1 });
  expect(place.now()).toBeNull();
  expect(geocode).toHaveBeenCalledExactlyOnceWith({ latitude: 10.1, longitude: 20.1 });
  await act(async () => answer.settle([{ name: 'Усадьба «Остафьево»', city: 'Москва' }]));
  expect(place.now()).toBe('Усадьба «Остафьево», Москва');
});

test('a phone with nothing to say leaves the name nothing for good', async () => {
  geocode.mockResolvedValueOnce([]);
  const place = await probe({ latitude: 11.1, longitude: 21.1 });
  expect(place.now()).toBeNull();
  geocode.mockRejectedValueOnce(Object.assign(new Error('no'), { code: 'ERR_GEOCODE' }));
  vi.spyOn(console, 'warn').mockImplementationOnce(() => {});
  const failing = await probe({ latitude: 12.1, longitude: 22.1 });
  expect(failing.now()).toBeNull();
});

test('an answer that comes in for the frame before is not the name of the frame now on the sheet', async () => {
  const first = later<unknown>();
  const second = later<unknown>();
  geocode.mockImplementation(((where: { latitude: number }) =>
    (where.latitude === 13.1 ? first : second).promise) as never);
  const place = await probe({ latitude: 13.1, longitude: 23.1 });
  // The sheet stays mounted and is handed the next frame before the first has been named.
  await place.move({ latitude: 14.1, longitude: 24.1 });
  expect(place.now()).toBeNull();
  await act(async () => first.settle([{ city: 'Москва' }]));
  // The late one is for a point that is gone: nothing of it may show, at any render on the way.
  expect(place.all()).not.toContain('Москва');
  expect(place.now()).toBeNull();
  await act(async () => second.settle([{ city: 'Казань' }]));
  expect(place.now()).toBe('Казань');
});

test('moving to another point never shows the last point’s name over it, even for the one render before the next answer', async () => {
  const other = later<unknown>();
  geocode.mockImplementation(((where: { latitude: number }) =>
    where.latitude === 15.1 ? Promise.resolve([{ city: 'Москва' }]) : other.promise) as never);
  const place = await probe({ latitude: 15.1, longitude: 25.1 });
  expect(place.now()).toBe('Москва');
  await place.move({ latitude: 16.1, longitude: 26.1 });
  expect(place.now()).toBeNull();
  // And back to the first, which the app already knows: its name is there with no second ask.
  geocode.mockClear();
  await place.move({ latitude: 15.1, longitude: 25.1 });
  expect(place.now()).toBe('Москва');
  expect(geocode).not.toHaveBeenCalled();
});

test('a frame that has lost its point loses the name with it', async () => {
  geocode.mockResolvedValueOnce([{ city: 'Москва' }] as never);
  const place = await probe({ latitude: 17.1, longitude: 27.1 });
  expect(place.now()).toBe('Москва');
  await place.move({ latitude: null, longitude: null });
  expect(place.now()).toBeNull();
});

test('a sheet that is gone before the phone answers is not written to', async () => {
  const answer = later<unknown>();
  geocode.mockReturnValueOnce(answer.promise as never);
  const place = await probe({ latitude: 18.1, longitude: 28.1 });
  await place.unmount();
  const seen = place.all().length;
  await act(async () => answer.settle([{ city: 'Москва' }]));
  // Nothing rendered again, and nothing of the answer ever reached the hook's reader.
  expect(place.all()).toHaveLength(seen);
  expect(place.all()).not.toContain('Москва');
});
