import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Image } from 'expo-image';
import type { ReactElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { expect, test } from 'vitest';
import { CardMemory } from '@/kit/card-memory';
import { CardMontage, PosterFilm } from '@/kit/card-montage';
import { CoverSlot } from '@/kit/cover';
import { Filmstrip, Mosaic } from '@/kit/filmstrip';
import { pictureKey } from '@/lib/picture-key';

/**
 * Doc-15 — what a picture off a signed link is filed under on the phone.
 *
 * Every link the api hands out is signed afresh on every read and lives a quarter of an hour, while
 * `expo-image`'s own key is the whole url. A screen opening a second time therefore downloads the
 * same bytes again — the flicker of grey tiles on the main screen — unless each picture is filed
 * under something that does not move. A record has an id for that; a mosaic cell, a cover and a
 * montage poster arrive as a bare link, and `pictureKey` takes the object's own path from it.
 */

mountsTrees();

const OBJECT = 'https://r2.example/thumbs/00000000-0000-4000-8000-000000000001.jpg';
const SIGNED = `${OBJECT}?X-Amz-Signature=aaa`;
const RESIGNED = `${OBJECT}?X-Amz-Signature=bbb`;

async function drawn(node: ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(node));
  });
  return tree.root;
}

const sourcesOf = async (node: ReactElement) =>
  (await drawn(node)).findAllByType(Image).map((one) => one.props.source);

test('the key is the object’s path, so two reads of one picture are one file on the phone', () => {
  expect(pictureKey(SIGNED)).toBe(OBJECT);
  expect(pictureKey(RESIGNED)).toBe(OBJECT);
  // No signature to cut: the link is its own key.
  expect(pictureKey('https://r2.example/a.jpg')).toBe('https://r2.example/a.jpg');
});

test('the mosaics a memory is drawn from are filed under the object, never the signature', async () => {
  // The cells of a card's mosaic and of the empty films block are `card_thumbnail_urls` /
  // `recent_thumbnail_urls` — bare links with no record id beside them.
  const [before] = await sourcesOf(<Mosaic photos={[SIGNED]} />);
  const [after] = await sourcesOf(<Mosaic photos={[RESIGNED]} />);
  expect(before).toEqual({ uri: SIGNED, cacheKey: OBJECT });
  expect(after.cacheKey).toBe(before.cacheKey);
  expect(after.cacheKey).not.toContain('X-Amz-Signature');
});

test('a chosen cover and the memory’s own square are one file with the mosaic behind them', async () => {
  const [cover] = await sourcesOf(<CardMemory title="Свадьба" thumbs={[]} cover={SIGNED} large />);
  expect(cover).toEqual({ uri: SIGNED, cacheKey: OBJECT });

  const [slot] = await sourcesOf(<CoverSlot uri={SIGNED} />);
  expect(slot.cacheKey).toBe(OBJECT);
});

test('a montage’s poster is filed the same way on its card and on the film’s own screen', async () => {
  const [card] = await sourcesOf(<CardMontage title="Ролик" state="ready" poster={SIGNED} />);
  expect(card.cacheKey).toBe(OBJECT);

  const [film] = await sourcesOf(<PosterFilm poster={SIGNED} label="Смотреть ролик" />);
  expect(film.cacheKey).toBe(OBJECT);
});

test('the filmstrip carries the record’s key through, so a neighbour is not fetched again', async () => {
  const [shot] = await sourcesOf(
    <Filmstrip
      frames={[{ uri: SIGNED, cacheKey: '00000000-0000-4000-8000-000000000001:thumb' }]}
      index={0}
    />,
  );
  expect(shot).toEqual({
    uri: SIGNED,
    cacheKey: '00000000-0000-4000-8000-000000000001:thumb',
  });
});
