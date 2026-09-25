import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Image } from 'expo-image';
import TestRenderer, { act } from 'react-test-renderer';
import { expect, test } from 'vitest';

import { DashedFrame } from '@/kit/bits';
import { CoverSlot } from '@/kit/cover';
import { Mosaic } from '@/kit/filmstrip';
import { story } from '@/kit/story';

/** Spec 6 — the cover of a memory as a square, and the one chain it is drawn by. */

mountsTrees();

const draw = async (node: React.ReactElement) => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(TestRenderer.create(node));
  });
  return tree.root;
};

test('the slot is the chosen frame, else the mosaic of the memory’s own frames — one of them is enough — else the dashed frame', async () => {
  const picture = await draw(
    <CoverSlot uri="https://r2.example/a" thumbs={['https://r2.example/t1']} />,
  );
  expect(picture.findAllByType(Image).map((one) => one.props.source.uri)).toEqual([
    'https://r2.example/a',
  ]);
  expect(picture.findAllByType(Mosaic)).toHaveLength(0);

  const one = await draw(<CoverSlot uri={null} thumbs={['https://r2.example/t1']} />);
  expect(one.findByType(Mosaic).props.photos).toEqual(['https://r2.example/t1']);
  expect(one.findAllByType(DashedFrame)).toHaveLength(0);

  for (const bare of [
    <CoverSlot key="a" />,
    <CoverSlot key="b" uri={null} thumbs={[]} />,
    <CoverSlot key="c" uri="" thumbs={[]} />,
  ]) {
    const empty = await draw(bare);
    expect(empty.findAllByType(DashedFrame)).toHaveLength(1);
    expect(empty.findAllByType(Mosaic)).toHaveLength(0);
    expect(empty.findAllByType(Image)).toHaveLength(0);
  }
});

test('68 on the card, 64 on the sheet that asks — at every link of the chain', () => {
  for (const chain of [
    { uri: 'https://r2.example/a' },
    { thumbs: ['https://r2.example/t1'] },
    {},
  ]) {
    expect(story(<CoverSlot {...chain} />)).toContain('width:68px');
    expect(story(<CoverSlot {...chain} size={64} />)).toContain('width:64px');
  }
});
