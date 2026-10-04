import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Image } from 'expo-image';
import type { ReactElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, expect, test, vi } from 'vitest';

import { CardMemory, TURN_MS } from '@/kit/card-memory';

/**
 * TASK-525 (doc-12): «на главном экране нужно, чтобы периодически менялись фотки, которые
 * отображаются у воспоминаний. Сегодня карточка памяти всегда показывает одно и то же».
 *
 * `card-memory.test.tsx` draws the card through a story and cannot see a clock — a story is one
 * render and no effect ever runs. What is checked here is the turn itself: that the frames come
 * round, that the one somebody chose is never one of them, and that nothing is asked for.
 *
 * Read off the pictures the card is drawing rather than off the array it was handed: the array
 * carries every signed link the listing gave, while the cells hold four of them (three on the
 * large mosaic) — a turn that moved the list without moving a single cell would pass on the first
 * and fail here.
 */

mountsTrees();

afterEach(() => {
  vi.useRealTimers();
});

const FRAMES = [
  'https://r2.example/1',
  'https://r2.example/2',
  'https://r2.example/3',
  'https://r2.example/4',
];
/** Somebody's own pick of what this memory looks like (spec 10.8.3). */
const COVER = 'https://r2.example/cover';

async function draw(card: ReactElement) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
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
    turn: () => act(async () => void vi.advanceTimersByTime(TURN_MS)),
    rest: (ms: number) => act(async () => void vi.advanceTimersByTime(ms)),
  };
}

test('the frames on a card come round, one frame at a time, and come back to where they were', async () => {
  const card = await draw(<CardMemory title="Свадьба" meta={['12 сентября']} thumbs={FRAMES} />);
  expect(card.drawn()).toEqual(FRAMES);

  await card.turn();
  expect(card.drawn()).toEqual([FRAMES[1], FRAMES[2], FRAMES[3], FRAMES[0]]);
  await card.turn();
  expect(card.drawn()).toEqual([FRAMES[2], FRAMES[3], FRAMES[0], FRAMES[1]]);
  await card.turn();
  await card.turn();
  // As many turns as there are frames and it is the card it was on the first time — a loop, not a
  // walk off the end of the list into nothing.
  expect(card.drawn()).toEqual(FRAMES);

  // And past that, rather than only up to it. A count that keeps climbing past the frames it walks
  // between has nothing left to show, and `slice` past the end answers with nothing rather than
  // complaining — so a card can stand still without ever looking broken. Asked a fifth time on,
  // which is where the two answers part: a count that folded back is on its second frame, and one
  // that kept climbing is showing a strip of four out of an empty tail.
  for (let step = 0; step < FRAMES.length + 1; step += 1) await card.turn();
  expect(card.drawn()).toEqual([FRAMES[1], FRAMES[2], FRAMES[3], FRAMES[0]]);
});

test('the turn waits: nothing moves before the card has stood long enough to be read', async () => {
  const card = await draw(<CardMemory title="Свадьба" meta={['12 сентября']} thumbs={FRAMES} />);
  await card.rest(TURN_MS - 1);
  expect(card.drawn()).toEqual(FRAMES);
  await card.rest(1);
  expect(card.drawn()).not.toEqual(FRAMES);
});

test('the frame somebody chose is not one of the frames that change, on either card', async () => {
  // Five frames rather than four, and a chosen frame that is one of them — so the cover really is
  // among the frames on offer and could be picked up by the turn if anything swept the whole tail.
  const frames = [COVER, ...FRAMES];
  const ordinary = await draw(
    <CardMemory title="Свадьба" meta={['12 сентября']} thumbs={frames} cover={COVER} />,
  );
  // A whole turn round, not one step: the cover leads the strip and stays leading it, and the three
  // cells behind it hold three different frames of the tail — never the cover a second time, which
  // is what a turn that swept the whole `thumbs` would put in the strip behind it, and never fewer
  // than three, which is what a tail cut short on a card that does have frames to show would leave.
  for (let at = 0; at < frames.length + 1; at += 1) {
    const [first, ...tail] = ordinary.drawn();
    expect(first).toBe(COVER);
    expect(tail).toEqual([
      FRAMES[at % FRAMES.length],
      FRAMES[(at + 1) % FRAMES.length],
      FRAMES[(at + 2) % FRAMES.length],
    ]);
    await ordinary.turn();
  }

  const large = await draw(
    <CardMemory title="Свадьба" meta={['12 сентября']} thumbs={frames} cover={COVER} large />,
  );
  expect(large.drawn()).toEqual([COVER]);
  await large.turn();
  expect(large.drawn()).toEqual([COVER]);
});

test('a card with nothing to turn keeps no clock at all', async () => {
  // On the large card the chosen frame is the whole face and there is nothing behind it, and a card
  // with one frame in it has nothing to walk to. Both draw the same picture for as long as they are
  // on screen, and neither is woken up: a clock kept running for a card that never draws differently
  // is a phone doing work for nothing. Counted rather than read off the tree — a mosaic behind a
  // cover is not drawn at all, so only the clock itself shows that the turn stood down.
  const covered = await draw(
    <CardMemory
      title="Свадьба"
      meta={['12 сентября']}
      thumbs={[COVER, ...FRAMES]}
      cover={COVER}
      large
    />,
  );
  expect(covered.clocks()).toBe(0);

  const one = await draw(
    <CardMemory title="Свадьба" meta={['12 сентября']} thumbs={[FRAMES[0]]} />,
  );
  expect(one.clocks()).toBe(0);

  // And a card that does turn keeps exactly one — its own, not one for the list around it.
  const turning = await draw(<CardMemory title="Свадьба" meta={['12 сентября']} thumbs={FRAMES} />);
  expect(turning.clocks()).toBe(1);
});

test('the large card turns its own mosaic, and a card with one frame in it stands still', async () => {
  const large = await draw(
    <CardMemory title="Свадьба" meta={['12 сентября']} thumbs={FRAMES} large />,
  );
  expect(large.drawn()).toEqual([FRAMES[0], FRAMES[1], FRAMES[2]]);
  await large.turn();
  expect(large.drawn()).toEqual([FRAMES[1], FRAMES[2], FRAMES[3]]);

  const one = await draw(
    <CardMemory title="Свадьба" meta={['12 сентября']} thumbs={[FRAMES[0]]} />,
  );
  await one.turn();
  await one.turn();
  expect(one.drawn()).toEqual([FRAMES[0]]);
});

test('a turn asks the api for nothing — the frames it walks between are the ones it was handed', async () => {
  // The listing signs those links for a quarter of an hour and the frames die with the session
  // (decision-23). A card that asked for more would be a card holding a link open past its life
  // and a phone fetching photographs nobody is looking at.
  const asked: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    asked.push(String(url));
    return new Response('[]', { status: 200 });
  });
  try {
    const card = await draw(<CardMemory title="Свадьба" meta={['12 сентября']} thumbs={FRAMES} />);
    await card.turn();
    await card.turn();
    expect(asked).toEqual([]);
  } finally {
    vi.unstubAllGlobals();
  }
});
