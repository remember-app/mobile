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

async function draw(card: ReactElement) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(card));
  });
  return {
    /** The frames on the card right now, cell by cell, in the order the card draws them. */
    drawn: () => tree.root.findAllByType(Image).map((one) => one.props.source.uri as string),
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
});

test('the turn waits: nothing moves before the card has stood long enough to be read', async () => {
  const card = await draw(<CardMemory title="Свадьба" meta={['12 сентября']} thumbs={FRAMES} />);
  await card.rest(TURN_MS - 1);
  expect(card.drawn()).toEqual(FRAMES);
  await card.rest(1);
  expect(card.drawn()).not.toEqual(FRAMES);
});

test('the frame somebody chose is not one of the frames that change, on either card', async () => {
  const cover = 'https://r2.example/cover';
  const ordinary = await draw(
    <CardMemory title="Свадьба" meta={['12 сентября']} thumbs={FRAMES} cover={cover} />,
  );
  expect(ordinary.drawn()).toEqual([cover, FRAMES[0], FRAMES[1], FRAMES[2]]);
  await ordinary.turn();
  // It leads the strip and stays leading it — the tail behind it turns, the chosen frame does not.
  expect(ordinary.drawn()).toEqual([cover, FRAMES[1], FRAMES[2], FRAMES[3]]);

  // On the large card the chosen frame is the whole face, and there is nothing behind it to turn:
  // the card draws one picture and keeps drawing it.
  const large = await draw(
    <CardMemory title="Свадьба" meta={['12 сентября']} thumbs={FRAMES} cover={cover} large />,
  );
  expect(large.drawn()).toEqual([cover]);
  await large.turn();
  expect(large.drawn()).toEqual([cover]);
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
