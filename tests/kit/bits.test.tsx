import { ImageIcon } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import {
  DashedFrame,
  Divider,
  LiveDot,
  MetaDot,
  PhotoStack,
  Progress,
  StepScale,
  VideoTrack,
} from '@/kit/bits';
import { IconButton } from '@/kit/button';
import { allDifferent, story } from '@/kit/story';
import { Text } from '@/kit/text';
import { setTheme } from '@/theme';

/** Spec 7.9 — the small parts every other part is built from. */

beforeAll(async () => {
  await setTheme('dark');
});

test('the hairline is one hairline, and it can stretch across a gap', () => {
  allDifferent({ plain: <Divider />, stretching: <Divider grow /> });
});

test('the meta dot turns white on a photograph, because lineStrong would disappear into it', () => {
  allDifferent({ onInk: <MetaDot />, onPhoto: <MetaDot onPhoto /> });
  // And it is decoration: it carries no words and nothing to read out.
  expect(story(<MetaDot />)).not.toContain('aria-label');
});

test('the step scale fills as the wizard walks, and says where it is out loud', () => {
  allDifferent(
    Object.fromEntries(
      [1, 2, 3, 4].map((done) => [String(done), <StepScale steps={4} done={done} />]),
    ),
  );
  const scale = story(<StepScale steps={4} done={2} />);
  expect(scale).toContain('role="progressbar"');
});

test('the five-segment variant puts what is done behind it in spark and what is running in accent', () => {
  allDifferent({
    wizard: <StepScale steps={5} done={3} />,
    building: <StepScale steps={5} done={3} tone="spark" />,
  });
});

test('a progress bar reaches for its value and never past either end of it', () => {
  const half = story(<Progress value={0.5} label="Отправка" />);
  expect(half).toContain('width:50%');
  expect(half).toContain('role="progressbar"');
  // Out-of-range numbers are held at the ends rather than drawn off the bar.
  expect(story(<Progress value={2} label="Отправка" />)).toContain('width:100%');
  expect(story(<Progress value={-1} label="Отправка" />)).toContain('width:0%');
});

test('the two bars are two bars: accent for what is being sent, spark for what is in', () => {
  allDifferent({
    sending: <Progress value={0.26} label="Отправка" />,
    brought: <Progress value={0.26} tone="spark" label="Вклад" />,
    onCover: <Progress value={0.26} tone="spark" onPhoto label="Вклад" />,
  });
});

test('the video scrubber is its own line above the strip, so two gestures never share a finger', () => {
  const track = story(
    <VideoTrack
      at="0:24"
      of="1:08"
      value={0.35}
      label="Просмотрено"
      sound={<IconButton icon={ImageIcon} label="Звук" size={36} />}
    />,
  );
  expect(track).toContain('0:24');
  expect(track).toContain('1:08');
  expect(track).toContain('width:35%');
  // The handle rides the same number, so the two can never disagree.
  expect(track).toContain('left:35%');
  expect(track).toContain('aria-label="Звук"');
});

test('the scrubber takes a finger when it is given somewhere to send it, and reports when it is not', () => {
  // «Видео нельзя перемотать: ползунок не тянется, по полосе не нажимается» — off a device
  // (TASK-181). A bar that only reports is a film watched from the start every time.
  const read = (
    <VideoTrack at="0:24" of="1:08" value={0.35} label="Просмотрено" />
  );
  const wound = (
    <VideoTrack at="0:24" of="1:08" value={0.35} label="Просмотрено" onSeek={() => {}} />
  );
  allDifferent({ read: read, wound: wound });
  // A bar that moves says so: «adjustable» is what carries the two steps a screen reader has
  // instead of a finger, and the one that cannot move stays what every other bar here is. The web
  // the harness renders through calls that role `slider`; on a phone it is `adjustable`.
  expect(story(read)).toContain('role="progressbar"');
  expect(story(wound)).toContain('role="slider"');
  // And the line is the same 4 either way — what grew is the share of it a finger has to hit.
  expect(story(wound)).toContain('width:35%');
  expect(story(wound)).toContain('left:35%');
  // A finger past either end of the bar is held at that end, the way every other bar here holds.
  const past = <VideoTrack at="1:08" of="1:08" value={2} label="Просмотрено" onSeek={() => {}} />;
  expect(story(past)).toContain('width:100%');
  expect(story(past)).toContain('left:100%');
});

test('the onboarding stack is three photographs at three angles, in two sizes', () => {
  const photos = ['https://b/1.jpg', 'https://b/2.jpg', 'https://b/3.jpg'];
  allDifferent({
    large: <PhotoStack photos={photos} />,
    small: <PhotoStack photos={photos} small />,
  });
  // Three and no more, however many are handed over, and none of them is read out.
  const many = story(<PhotoStack photos={[...photos, 'https://b/4.jpg']} />);
  expect(many.match(/data-testid="image"/g)).toHaveLength(3);
  expect(many).not.toContain('aria-label');
});

test('the dashed frame stands where a strip of photographs would, and says why it is empty', () => {
  const frame = story(
    <DashedFrame>
      <Text role="meta">Ни одного кадра — скиньте первые</Text>
    </DashedFrame>,
  );
  expect(frame).toContain('Ни одного кадра — скиньте первые');
  expect(frame).toContain('border-top-style:dashed');
});

test('the live dot is its own mark, and it is not the meta dot in red', () => {
  // Spec 7.4: 6px of `danger` meaning «right now» — the one place that colour is not danger. It
  // says nothing out loud: whatever it stands beside carries the word.
  allDifferent({
    live: <LiveDot />,
    meta: <MetaDot />,
  });
  expect(story(<LiveDot />)).not.toContain('aria-label');
});
