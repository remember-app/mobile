import { rule, shorthand } from '@tests/helpers/css';
import { ImageIcon } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import {
  DashedFrame,
  DashedNote,
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
import { font, setTheme, themes, type } from '@/theme';

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

/**
 * A colour token as the sheet writes it — `line` on the phone, `rgba(44,44,58,1.00)` in a class.
 * The tone comes from the theme the file draws in, so a colour moved there moves here with it and
 * nothing is spelled out twice.
 */
const background = (token: string) =>
  `background-color:rgba(${(token.slice(1).match(/../g) ?? [])
    .map((pair) => parseInt(pair, 16))
    .join(',')},1.00)`;

test('the paper scale lays a `line` track under the fill, so the step ahead is a road and not a hole', () => {
  // Spec 7.1, detail 75: 4px, what is walked in `paper`, what is ahead in `line`. Every rule is found
  // by what it says and not by what it is called, so nothing here names a class of its own.
  const track = rule(background(themes.dark.color.line));
  const walked = rule(background(themes.dark.color.paper));
  const stopped = rule(background(themes.dark.color.dangerText));
  const clip = shorthand('overflow', 'overflow-x:hidden');
  const drawn = story(<StepScale tone="paper" steps={5} done={2} stopped />);

  // One track to a step, all five of them — the three the walk has not reached included — each
  // painted in `line` and clipping what rides on it.
  const segments = [...drawn.matchAll(/<div class="([^"]*)"><div class="([^"]*)"/g)];
  expect(segments).toHaveLength(5);
  for (const [, own] of segments) {
    expect(own).toContain(track);
    expect(own).toContain(clip);
  }

  // And the fill is over that track, in its own tone: `paper` on the four the walk has come
  // through, `dangerText` on the one that stopped. No fill is drawn in the track's own colour —
  // that is the scale gone blank, which is the whole thing the track is here to prevent.
  const fills = segments.map(([, , own]) => own);
  expect(fills.filter((fill) => fill.includes(stopped))).toHaveLength(1);
  for (const fill of fills.filter((one) => !one.includes(stopped))) expect(fill).toContain(walked);
  for (const fill of fills) expect(fill).not.toContain(track);
});

test('the wizard’s tone paints the segment itself: no track under it, and nothing that moves', () => {
  // The other two tones are not a fill over a road — the segment is its own paint. So nothing here
  // is clipped and nothing carries a width: `overflow:hidden` and a `style="width:…"` are the two
  // things the paper tone has and these do not.
  const wizard = story(<StepScale steps={5} done={3} />);
  expect(wizard).toContain(rule(background(themes.dark.color.accent)));
  expect(wizard).toContain(rule(background(themes.dark.color.line)));
  expect(wizard).not.toContain(shorthand('overflow', 'overflow-x:hidden'));
  expect(wizard).not.toMatch(/style="width:/);
  expect(story(<StepScale tone="spark" steps={5} done={3} />)).toContain(
    rule(background(themes.dark.color.spark)),
  );
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

test('the scrubber reads both timecodes at 12 / 600 — what has played in paper, the length at 66%', () => {
  // Spec 7.10 and 10.10: not the `meta` role at 500, and no white of its own: the night's `paper`
  // for the time played, `rgba(245,243,238,.66)` for the whole length.
  const track = story(<VideoTrack at="0:24" of="1:08" value={0.35} label="Просмотрено" />);
  const classOf = (time: string) => track.match(new RegExp(`class="([^"]*)">${time}<`))?.[1];
  const semi = rule(`font-family:${font.semi}`);
  const twelve = rule('font-size:12px');
  for (const time of ['0:24', '1:08']) {
    expect(classOf(time)).toContain(semi);
    expect(classOf(time)).toContain(twelve);
  }
  expect(classOf('0:24')).toContain(rule('color:rgba(245,243,238,1.00)'));
  expect(classOf('1:08')).toContain(rule('color:rgba(245,243,238,0.66)'));
});

test('the scrubber’s track is paper at .24, 10 from the timecodes either side', () => {
  // Spec 7.10 and 10.11 (answer 7): «дорожка видео — щель 10, фон `.24`» — it lay on the viewer's
  // glass at .10 with 12 either side.
  const track = story(<VideoTrack at="0:24" of="1:08" value={0.35} label="Просмотрено" />);
  expect(track).toContain(rule('background-color:rgba(245,243,238,0.24)'));
  expect(track).toContain(rule('gap:10px'));
});

test('the scrubber takes a finger when it is given somewhere to send it, and reports when it is not', () => {
  // «Видео нельзя перемотать: ползунок не тянется, по полосе не нажимается» — off a device
  // (TASK-181). A bar that only reports is a film watched from the start every time.
  const read = <VideoTrack at="0:24" of="1:08" value={0.35} label="Просмотрено" />;
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

test('the onboarding stack is three photographs at three angles', () => {
  const photos = ['https://b/1.jpg', 'https://b/2.jpg', 'https://b/3.jpg'];
  // Three and no more, however many are handed over, and none of them is read out.
  const many = story(<PhotoStack photos={[...photos, 'https://b/4.jpg']} />);
  expect(many.match(/data-testid="image"/g)).toHaveLength(3);
  expect(many).not.toContain('aria-label');
});

/**
 * Where the layout puts each frame before it is turned — spec 7.10, `design/screens/Login.html` of
 * 27 September: the box 176, the side frames 34 off their own edge, the middle one centred and lower
 * than the two beside it. Left, middle, right, in the order they are drawn.
 */
const LAYOUT = {
  stack: ['height:176px'],
  frames: [
    ['left:34px', 'top:12px', 'width:116px', 'height:144px', 'rotate(-9deg)', 'radius:16px'],
    ['top:16px', 'width:136px', 'height:158px', 'rotate(-1.5deg)', 'radius:18px'],
    ['right:34px', 'top:6px', 'width:116px', 'height:144px', 'rotate(8deg)', 'radius:16px'],
  ],
} as const;

/** The class a declaration of the stack compiled to, by the short name `LAYOUT` gives it. */
const declared = (short: string) =>
  short.startsWith('rotate')
    ? rule(`transform:${short}`)
    : short.startsWith('radius')
      ? shorthand('borderRadius', `border-top-left-radius:${short.slice(7)}`)
      : rule(short);

test('the stack puts its three frames where the layout measured them', () => {
  const photos = ['https://b/1.jpg', 'https://b/2.jpg', 'https://b/3.jpg'];
  const drawn = story(<PhotoStack photos={photos} />);
  const [box, ...frames] = drawn.split('data-testid="image"');
  for (const css of LAYOUT.stack) expect(box, css).toContain(declared(css));
  // The last class list before each marker is that frame's own.
  LAYOUT.frames.forEach((shot, i) => {
    const own = (i === 0 ? box : frames[i - 1]).split('class="').at(-1) ?? '';
    for (const css of shot) expect(own, `frame ${i}: ${css}`).toContain(declared(css));
  });
  expect(frames).toHaveLength(3);
});

test('the stack runs the width of the board, so the side frames never leave a narrow phone', () => {
  // Hung off the board's edges and not off a box of their own: 320 overlaps them more and keeps
  // them on the screen. Past the layout's 390 it stays that wide, and cuts what reaches over it.
  const drawn = story(<PhotoStack photos={['a', 'b', 'c']} />);
  for (const css of ['width:100%', 'max-width:390px']) expect(drawn, css).toContain(rule(css));
  expect(drawn).toContain(shorthand('overflow', 'overflow-x:hidden'));
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

test('the plate over a day’s unseen rest is hollow and dashed in `line`, where the empty strip is filled', () => {
  // `UploadLimited.json` e18/e19: 358 × 67, `1px dashed #2C2C3A`, radius 18, no fill — one line of
  // 13 / 500, centred. Spec 8 (`UploadLimited`) and 10.1 read that line in `muted` #A4A1B2, not the
  // layout's `faint` #6E6B7D; the note's line is 19, so 23 over and under it inside the hairline make
  // the 67 (it was 24, and the plate came out 69). The app first drew it as the empty strip of a
  // card: filled with `raise`, dashed in `dashed`, 49 tall.
  const note = story(<DashedNote text="Остальное с этого дня Remember не видит" />);
  expect(note).toContain('Остальное с этого дня Remember не видит');
  for (const [property, css] of [
    ['borderStyle', 'border-top-style:dashed'],
    ['borderColor', 'border-top-color:rgba(44,44,58,1.00)'],
    ['borderRadius', 'border-top-left-radius:18px'],
  ])
    expect(note, css).toContain(shorthand(property, css));
  for (const css of [
    'padding-bottom:23px;padding-top:23px',
    'padding-left:16px;padding-right:16px',
    `font-family:${type.note.fontFamily}`,
    'color:rgba(164,161,178,1.00)',
    'text-align:center',
  ])
    expect(note, css).toContain(rule(css));
  expect(note).not.toContain('color:rgba(110,107,125,1.00)');
  expect(note).not.toContain('background-color');
  expect([type.note.fontSize, type.note.fontFamily]).toEqual([13, 'Onest_500Medium']);
  expect(1 + 23 + Number(type.note.lineHeight) + 23 + 1).toBe(67);
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
