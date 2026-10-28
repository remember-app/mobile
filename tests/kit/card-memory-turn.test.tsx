import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Image } from 'expo-image';
import type { ReactElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, expect, test, vi } from 'vitest';

import { CardMemory, FACE_MS, pickFrames } from '@/kit/card-memory';

/**
 * TASK-544 (doc-12): «на главном экране фотографии воспоминания меняются каждые 5 часов и
 * выбираются случайно из всего воспоминания».
 *
 * `card-memory.test.tsx` draws the card through a story and cannot see a clock — a story is one
 * render and no effect ever runs. What is checked here is the face itself: that it is drawn from the
 * whole pool the listing brought and not only its head, that it stands still until five hours are
 * up, that the one frame somebody chose is never one of the ones that change, and that nothing is
 * asked for.
 *
 * Read off the pictures the card is drawing rather than off the array it was handed: the array
 * carries every signed link the listing gave, while the cells hold four of them — a face that chose
 * from the pool without any of it reaching a cell would pass on the first and fail here.
 */

mountsTrees();

afterEach(() => {
  vi.useRealTimers();
});

/** A pool wide enough that which four of it are on the card is a real question. */
const POOL = Array.from({ length: 12 }, (_, i) => `https://r2.example/${i}`);
/** Somebody's own pick of what this memory looks like (spec 10.8.3). */
const COVER = 'https://r2.example/cover';
/** The start of a five-hour window exactly, so «not yet» and «now» are a millisecond apart. */
const START = 1000 * FACE_MS;

async function draw(card: ReactElement) {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(START);
  const before = vi.getTimerCount();
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(card));
  });
  return {
    /** The frames on the card right now, cell by cell, in the order the card draws them. */
    drawn: () => tree.root.findAllByType(Image).map((one) => one.props.source.uri as string),
    /** How many clocks this card put up on mounting — its own, and nobody else's. */
    clocks: () => vi.getTimerCount() - before,
    rest: (ms: number) => act(async () => void vi.advanceTimersByTime(ms)),
  };
}

test('the whole pool is on offer, not only its head — and one window is always the same face', () => {
  // The api already drew these twelve at random from the whole memory (TASK-543); the card's own
  // part is that the few it shows are not always the first of them, and that «случайно» does not
  // mean «different every time it is looked at».
  const seen = new Set<string>();
  for (let era = 1; era <= 60; era += 1) {
    const face = pickFrames(POOL, era);
    // A permutation of the pool: nothing lost, nothing repeated.
    expect([...face].sort()).toEqual([...POOL].sort());
    for (const uri of face.slice(0, 4)) seen.add(uri);
  }
  expect(seen.size).toBe(POOL.length);
  // The same window drawn twice is the same face, so a card drawn again by a scroll stands still.
  expect(pickFrames(POOL, 42)).toEqual(pickFrames(POOL, 42));
});

test('the frames on a card are drawn from the whole pool, and come round when the five hours are up', async () => {
  // The threshold itself, and not only the behaviour around it: a face that turned on the seven
  // seconds this used to would pass everything below and fail the person who asked for five hours.
  expect(FACE_MS).toBe(5 * 60 * 60 * 1000);

  const card = await draw(<CardMemory title="Свадьба" meta={['12 сентября']} thumbs={POOL} />);
  const first = card.drawn();
  expect(first).toHaveLength(4);
  expect(new Set(first).size).toBe(4);
  for (const uri of first) expect(POOL).toContain(uri);

  // Five hours short of the window turning: the same face, cell for cell — as long as the person
  // who looked away for a minute comes back to.
  await card.rest(FACE_MS - 1);
  expect(card.drawn()).toEqual(first);

  // At the boundary it is drawn again, from the same pool — a different few of the whole memory.
  await card.rest(1);
  const next = card.drawn();
  expect(next).not.toEqual(first);
  expect(new Set(next).size).toBe(4);
  for (const uri of next) expect(POOL).toContain(uri);
});

test('the frame somebody chose leads both cards and is never one of the ones that change', async () => {
  // Thirteen frames with the chosen one among them, so nothing here depends on the cover being
  // absent from the pool the card shuffles.
  const thumbs = [COVER, ...POOL];
  const ordinary = await draw(
    <CardMemory title="Свадьба" meta={['12 сентября']} thumbs={thumbs} cover={COVER} />,
  );
  const first = ordinary.drawn();
  expect(first[0]).toBe(COVER);
  expect(first).toHaveLength(4);
  expect(first.slice(1)).not.toContain(COVER);

  await ordinary.rest(FACE_MS);
  const next = ordinary.drawn();
  expect(next[0]).toBe(COVER);
  expect(next.slice(1)).not.toContain(COVER);

  // The large card keeps the chosen frame as its whole face, and never draws anything behind it.
  const large = await draw(
    <CardMemory title="Свадьба" meta={['12 сентября']} thumbs={thumbs} cover={COVER} large />,
  );
  expect(large.drawn()).toEqual([COVER]);
  await large.rest(FACE_MS);
  expect(large.drawn()).toEqual([COVER]);
});

test('a card with nothing to draw from keeps no clock at all', async () => {
  // On the large card the chosen frame is the whole face and there is nothing behind it, and a card
  // with one frame in it has nothing to draw differently at any hour. Both draw the same picture for
  // as long as they are on screen, and neither is woken up: a clock kept running for a card that
  // never draws differently is a phone doing work for nothing. Counted rather than read off the tree
  // — a mosaic behind a cover is not drawn at all, so only the clock itself shows the clock stood down.
  const covered = await draw(
    <CardMemory
      title="Свадьба"
      meta={['12 сентября']}
      thumbs={[COVER, ...POOL]}
      cover={COVER}
      large
    />,
  );
  expect(covered.clocks()).toBe(0);

  const one = await draw(<CardMemory title="Свадьба" meta={['12 сентября']} thumbs={[POOL[0]]} />);
  expect(one.clocks()).toBe(0);

  // And a card that does draw again keeps exactly one — its own, not one for the list around it.
  const turning = await draw(<CardMemory title="Свадьба" meta={['12 сентября']} thumbs={POOL} />);
  expect(turning.clocks()).toBe(1);
});

test('a redraw asks the api for nothing — the frames it draws from are the ones it was handed', async () => {
  // The listing signs those links for a quarter of an hour and the frames die with the session
  // (decision-23). A card that asked for more would be a card holding a link open past its life and
  // a phone fetching photographs nobody is looking at.
  const asked: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    asked.push(String(url));
    return new Response('[]', { status: 200 });
  });
  try {
    const card = await draw(<CardMemory title="Свадьба" meta={['12 сентября']} thumbs={POOL} />);
    await card.rest(FACE_MS);
    await card.rest(FACE_MS);
    expect(asked).toEqual([]);
  } finally {
    vi.unstubAllGlobals();
  }
});
