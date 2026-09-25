import { ChevronLeft, SquareCheckBig, Trash2, User } from 'lucide-react-native';
import { beforeAll, expect, test } from 'vitest';

import { ActionBar, AppBar, Board, type Footer, GlassBar, ViewerBar, WizardBar } from '@/kit/bars';
import { Button, IconButton } from '@/kit/button';
import { WatchingPill } from '@/kit/member';
import { allDifferent, compiled, story } from '@/kit/story';
import { Text } from '@/kit/text';
import { height, setTheme } from '@/theme';

/** Spec 7.1 — the frame of a screen: the board, the bar at the top, the layer at the bottom. */

beforeAll(async () => {
  await setTheme('dark');
});

test('the board is the screen’s own ink, with the device’s status line left empty', async () => {
  const board = (
    <Board>
      <Text>Тело</Text>
    </Board>
  );
  const dark = story(board);
  expect(dark).toContain('Тело');
  // The background is the one thing the board itself draws, and it is the theme's — so the same
  // board in daylight is a different board. A board dark by itself is the silent way this breaks.
  await setTheme('light');
  expect(story(board)).not.toBe(dark);
  await setTheme('dark');
});

test('the five bars that carry words are five bars', () => {
  allDifferent({
    root: (
      <AppBar
        title="Воспоминания"
        variant="root"
        right={<IconButton icon={User} label="Аккаунт" tone="surface" />}
      />
    ),
    inner: (
      <AppBar title="Свадьба Лизы и Марка" left={<IconButton icon={ChevronLeft} label="Назад" />} />
    ),
    withSubtitle: (
      <AppBar
        title="Ваши кадры"
        subtitle="Свадьба Лизы и Марка · 12–14 сентября"
        left={<IconButton icon={ChevronLeft} label="Назад" />}
      />
    ),
    withAction: (
      <AppBar
        title="Свадьба Лизы и Марка"
        left={<IconButton icon={ChevronLeft} label="Назад" />}
        right={<IconButton icon={User} label="Выбрать" />}
      />
    ),
    withQuiet: (
      <AppBar
        title="Воспоминание"
        left={<IconButton icon={ChevronLeft} label="Назад" />}
        quiet={{ icon: Trash2, label: 'Удалить воспоминание', onPress: () => {} }}
      />
    ),
  });
});

test('the quiet action is a bare 44 in `faint`, hung outside the margin like «Назад»', () => {
  const bar = story(
    <AppBar
      title="Воспоминание"
      left={<IconButton icon={ChevronLeft} label="Назад" />}
      quiet={{ icon: Trash2, label: 'Удалить воспоминание', onPress: () => {} }}
    />,
  );
  // Spec 7.1: there, and not arguing for the eye — the glyph is `faint`, and nothing is under it.
  expect(bar).toContain('aria-label="Удалить воспоминание"');
  expect(bar).toMatch(/data-glyph="Trash2"[^>]*stroke="#6E6B7D"/);
  expect(bar).toContain('r-marginRight-');
  expect(bar).toContain('width:44px');
  expect(
    story(<AppBar title="Воспоминание" left={<IconButton icon={ChevronLeft} label="Назад" />} />),
  ).not.toContain('Удалить воспоминание');
});

test('the name at the top of a screen is its heading, and a long one is cut rather than wrapped', () => {
  const bar = story(<AppBar title="Свадьба Лизы и Марка в Карелии" />);
  expect(bar).toContain('role="heading"');
  // Cut with an ellipsis: the button on the right of the bar must not be pushed off the screen by
  // a long memory name.
  expect(bar).toContain('r-textOverflow');
});

test('an inner bar closes to 8 and hangs its «Назад» outside the screen’s margin — and only it', () => {
  const inner = story(
    <AppBar
      title="Свадьба Лизы и Марка"
      left={<IconButton icon={ChevronLeft} label="Назад" />}
      right={<IconButton icon={User} label="Выбрать" />}
    />,
  );
  // Spec 7.1: −10 on the back button, so the glyph in it lines up with the words of the body rather
  // than the button's own edge. Nothing on the right is pulled: the layout draws the pill over a
  // montage on air on the margin, and a pill hung 10 outside it would stand 6 from the screen edge.
  expect(inner).toContain('r-marginLeft-');
  expect(inner).not.toContain('r-marginRight-');
  expect(
    story(
      <AppBar title="Свадьба Лизы и Марка" right={<IconButton icon={User} label="Выбрать" />} />,
    ),
  ).not.toContain('r-marginLeft-');

  // The root bar keeps 12 and its one button inside the margin: that one is filled, and a filled
  // button hung over the edge reads as falling off the screen.
  const root = story(
    <AppBar
      variant="root"
      title="Воспоминания"
      right={<IconButton icon={User} label="Аккаунт" tone="surface" />}
    />,
  );
  expect(root).not.toContain('r-marginRight-');
  // Two rhythms and not one — 8 in the inner bar, 12 in the root one.
  const gap = (markup: string) => markup.match(/r-gap-\w+/)?.[0];
  expect(gap(inner)).not.toBe(gap(root));
});

test('the second line under a name is there only when a screen has one', () => {
  const plain = story(<AppBar title="Ваши кадры" />);
  const withSub = story(<AppBar title="Ваши кадры" subtitle="Свадьба · 12–14 сентября" />);
  expect(plain).not.toContain('Свадьба · 12–14 сентября');
  expect(withSub).toContain('Свадьба · 12–14 сентября');
});

test('the wizard’s counter sits dead centre whatever stands on either side of it', () => {
  const wizard = story(
    <WizardBar
      step={2}
      steps={4}
      label="Шаг 2 из 4"
      back={<IconButton icon={ChevronLeft} label="Назад" />}
      cancel={<Button variant="quiet" label="Отмена" />}
    />,
  );
  expect(wizard).toContain('Шаг 2 из 4');
  expect(wizard).toContain('Отмена');
  // The scale under it says the same thing to a screen reader as the words above it.
  expect(wizard).toContain('role="progressbar"');
  allDifferent({
    first: <WizardBar step={1} steps={4} label="Шаг 1 из 4" />,
    last: <WizardBar step={4} steps={4} label="Шаг 4 из 4" />,
  });
});

test('the step’s heading belongs to the bar, because the bar is what does not scroll', () => {
  const step = story(
    <WizardBar
      step={3}
      steps={4}
      label="Шаг 3 из 4"
      title="Под что монтировать"
      note="Без музыки или один-несколько треков."
    />,
  );
  expect(step).toContain('Под что монтировать');
  expect(step).toContain('Без музыки или один-несколько треков.');
  // The line under the heading is there only where a step has one.
  expect(
    story(<WizardBar step={3} steps={4} label="Шаг 3 из 4" title="Под что монтировать" />),
  ).not.toContain('Без музыки');
});

test('the total has no scale under it, because there is no step after it', () => {
  const summary = story(
    <WizardBar step={4} steps={4} label="Итог" title="Свадьба Лизы и Марка" variant="summary" />,
  );
  // The scale is what says how far there is left to go, and the wizard's own progressbar with it.
  expect(summary).not.toContain('role="progressbar"');
  expect(story(<WizardBar step={4} steps={4} label="Шаг 4 из 4" title="Как собрать" />)).toContain(
    'role="progressbar"',
  );
});

test('the viewer’s bar floats on glass, because a photograph is the only surface under it', () => {
  const viewer = story(
    <ViewerBar
      date="13 сентября"
      meta="21:47 · Марк Ковалёв"
      left={<IconButton icon={ChevronLeft} label="Закрыть" tone="viewer" size={48} />}
    />,
  );
  expect(viewer).toContain('13 сентября');
  expect(viewer).toContain('21:47 · Марк Ковалёв');
  expect(viewer).toContain('Закрыть');
});

test('the viewer’s bar and the glass bar over the feed read the same in daylight as at night', async () => {
  // Both are glass over a photograph, and glass is dark in both themes (spec 2) — so the words and
  // the round buttons on it are read in the night's ink. A `paper` that turned dark in daylight
  // would put a dark glyph on dark glass, which is a bar with nothing on it.
  const viewer = (
    <ViewerBar
      date="13 сентября"
      meta="21:47 · Марк Ковалёв"
      label="Сведения"
      onPress={() => {}}
      left={<IconButton icon={ChevronLeft} label="Закрыть" tone="viewer" size={48} />}
    />
  );
  const glass = (
    <GlassBar
      title="Свадьба Лизы и Марка"
      meta="12–14 сентября · 6 человек"
      capsuleLabel="Свадьба Лизы и Марка"
      onCapsule={() => {}}
      left={<IconButton icon={ChevronLeft} label="Назад" tone="glass" size={48} />}
      right={<IconButton icon={SquareCheckBig} label="Выбрать" tone="glass" size={48} on />}
    />
  );
  const alone = <IconButton icon={ChevronLeft} label="Назад" tone="glass" size={48} />;
  const night = [story(viewer), story(glass), story(alone)];
  await setTheme('light');
  expect([story(viewer), story(glass)]).toEqual(night.slice(0, 2));
  // The pin is the bar's and not the button's: the same button on its own follows the theme, which
  // is what makes the comparison above a test of something.
  expect(story(alone)).not.toBe(night[2]);
  await setTheme('dark');
});

test('the viewer’s pill wears the layout’s hairline and reads its second line at the photograph’s quiet white', () => {
  // Spec 7.1, detail 5 and `Viewer`: the capsule has a 1px edge that the two round buttons do not.
  const pill = story(
    <ViewerBar
      date="13 сентября"
      meta="21:47 · Марк Ковалёв"
      label="Сведения"
      onPress={() => {}}
    />,
  );
  expect(pill).toContain('r-borderColor-');
  expect(pill).toContain('r-borderWidth-');
  // The chevron beside the words is drawn at the same quiet white as the words themselves — 72%, not
  // the 45% the meta dot is drawn in: a glyph or a line at 45% is unreadable over a bright frame.
  expect(pill).toContain('stroke="rgba(255,255,255,0.72)"');
  expect(pill).not.toContain('rgba(255,255,255,0.45)');
  expect(compiled()).toContain('{color:rgba(255,255,255,0.72);}');
  expect(compiled()).not.toContain('{color:rgba(255,255,255,0.45);}');
});

test('the pill in the middle of it is a button where it leads somewhere', () => {
  // Spec 7.1, detail 5: the whole capsule opens the frame's own sheet, and the `chevron-down` on it
  // is what says so. A pill with nowhere to go keeps its two floors and grows no arrow.
  const opens = story(
    <ViewerBar
      date="13 сентября"
      meta="21:47 · Марк Ковалёв"
      label="Сведения о кадре: 13 сентября, 21:47 · Марк Ковалёв"
      onPress={() => {}}
    />,
  );
  expect(opens).toContain('role="button"');
  expect(opens).toContain('aria-label="Сведения о кадре: 13 сентября, 21:47 · Марк Ковалёв"');
  expect(opens).toContain('data-glyph');
  allDifferent({
    plain: <ViewerBar date="13 сентября" meta="21:47 · Марк Ковалёв" />,
    opens: (
      <ViewerBar
        date="13 сентября"
        meta="21:47 · Марк Ковалёв"
        label="Сведения"
        onPress={() => {}}
      />
    ),
  });
});

test('the bar over a montage on air carries two floors and whatever stands on its right', () => {
  const live = (
    <AppBar
      variant="live"
      title="Монтаж идёт"
      subtitle="Для родителей · 2:30 · 16:9"
      left={<IconButton icon={ChevronLeft} label="Назад" />}
      right={<WatchingPill names={['Аня', 'Марк']} count={3} label="Смотрят сейчас: 3" />}
    />
  );
  expect(story(live)).toContain('Смотрят сейчас: 3');
  // 17/21 and not the inner bar's 18/21: three things have to fit on one line here.
  allDifferent({
    inner: <AppBar title="Монтаж идёт" subtitle="Для родителей · 2:30 · 16:9" />,
    live: <AppBar variant="live" title="Монтаж идёт" subtitle="Для родителей · 2:30 · 16:9" />,
  });
});

test('the glass bar over the feed is three pieces of glass and its own darkening', () => {
  const bar = story(
    <GlassBar
      title="Свадьба Лизы и Марка"
      meta="12–14 сентября · 6 человек"
      capsuleLabel="Свадьба Лизы и Марка. Настройки воспоминания и люди"
      onCapsule={() => {}}
      left={<IconButton icon={ChevronLeft} label="Назад" tone="glass" size={48} />}
      right={<IconButton icon={SquareCheckBig} label="Выбрать" tone="glass" size={48} />}
    />,
  );
  expect(bar).toContain('Свадьба Лизы и Марка');
  expect(bar).toContain('12–14 сентября · 6 человек');
  // The whole capsule is a button, and the name it is read out under is the full one — the drawn
  // one is cut with an ellipsis on purpose (spec 10.6).
  expect(bar).toContain('aria-label="Свадьба Лизы и Марка. Настройки воспоминания и люди"');
  expect(bar).toContain('r-textOverflow');
  // Spec 7.1: 176 of darkening under it, and glass at 62% in the capsule itself.
  expect(bar).toContain('height:176px');
  expect(bar).toContain('rgba(22,22,31,0.62)');
});

test('the capsule is a plate where it leads nowhere', () => {
  // `Upload`: «Ваши кадры» over the memory the material is going into, and nothing under it to open
  // — so the chevron goes with the press, and what is left announces itself as a heading.
  const plate = story(
    <GlassBar
      title="Ваши кадры"
      meta="в «Свадьба Лизы и Марка»"
      capsuleLabel="Ваши кадры, в «Свадьба Лизы и Марка»"
      left={<IconButton icon={ChevronLeft} label="Назад" tone="glass" size={48} />}
    />,
  );
  expect(plate).toContain('в «Свадьба Лизы и Марка»');
  expect(plate).toContain('role="heading"');
  // The same capsule with somewhere to go is a button and wears the chevron; this one has neither.
  const button = story(
    <GlassBar
      title="Ваши кадры"
      meta="в «Свадьба Лизы и Марка»"
      capsuleLabel="Ваши кадры, в «Свадьба Лизы и Марка»"
      onCapsule={() => {}}
      left={<IconButton icon={ChevronLeft} label="Назад" tone="glass" size={48} />}
    />,
  );
  expect(button).toContain('role="button"');
  expect(plate).not.toBe(button);
});

test('a capsule that acts instead of leading keeps the press and loses the chevron', () => {
  // `FramesPicking`: the same capsule counts what is marked and takes every frame — it is pressed,
  // and it opens nothing, so the glyph that promises something underneath goes.
  const [door, action] = [true, false].map((chevron) =>
    story(
      <GlassBar
        title="Выбрано 4"
        meta="38 МБ · 3 фото и 1 видео"
        capsuleLabel="Выбрано 4. Нажмите, чтобы выбрать все"
        onCapsule={() => {}}
        chevron={chevron}
        left={<IconButton icon={ChevronLeft} label="Лейблы" tone="glass" size={48} />}
      />,
    ),
  );
  // Both are buttons and both carry the same words; only one of them says it leads anywhere.
  for (const bar of [door, action]) {
    expect(bar).toContain('role="button"');
    expect(bar).toContain('38 МБ · 3 фото и 1 видео');
  }
  expect(door).not.toBe(action);
});

test('a capsule that leads somewhere wears the chevron without being told to, and one that leads nowhere has none to wear', () => {
  const bar = (props: { onCapsule?: () => void; chevron?: boolean }) =>
    story(
      <GlassBar
        title="Свадьба"
        meta="12–14 сентября"
        capsuleLabel="Свадьба. Настройки"
        left={<IconButton icon={ChevronLeft} label="Назад" tone="glass" size={48} />}
        {...props}
      />,
    );
  // The default is the door: a chevron says there is something underneath, and only an action turns it off.
  expect(bar({ onCapsule: () => {} })).toBe(bar({ onCapsule: () => {}, chevron: true }));
  expect(bar({ onCapsule: () => {} })).not.toBe(bar({ onCapsule: () => {}, chevron: false }));
  // A plate leads nowhere, so there is no press and no chevron whatever it is told.
  expect(bar({})).toBe(bar({ chevron: true }));
});

test('the right slot of the glass bar is empty where there is nothing to pick', () => {
  const full = story(
    <GlassBar
      title="Свадьба"
      capsuleLabel="Свадьба"
      left={<IconButton icon={ChevronLeft} label="Назад" tone="glass" size={48} />}
      right={<IconButton icon={SquareCheckBig} label="Выбрать" tone="glass" size={48} />}
    />,
  );
  const empty = story(
    <GlassBar
      title="Свадьба"
      capsuleLabel="Свадьба"
      left={<IconButton icon={ChevronLeft} label="Назад" tone="glass" size={48} />}
    />,
  );
  expect(full).toContain('Выбрать');
  expect(empty).not.toContain('Выбрать');
});

test('the bottom layer fades up into the screen and grows when a count stands over its button', () => {
  const one = story(
    <ActionBar>
      <Button variant="primary" label="Новое воспоминание" />
    </ActionBar>,
  );
  // The spec's own CSS, handed to React Native as the string it takes.
  expect(one).toContain('linear-gradient(to top, #0B0B12 58%, transparent)');
  expect(one).toContain('height:132px');

  const counted = story(
    <ActionBar above={<Text role="meta">Выбрано 12 из 61</Text>}>
      <Button variant="primary" label="Отправить 12 файлов" />
    </ActionBar>,
  );
  expect(counted).toContain('Выбрано 12 из 61');
  expect(counted).toContain('height:176px');
  expect(counted).toContain('62%');
});

test('the four footers are four depths, and two of them lie over photographs', () => {
  const at = (markup: string) => markup.match(/height:(\d+)px/)?.[1];
  const layer = (footer?: Footer) =>
    story(
      <ActionBar footer={footer}>
        <Button variant="primary" label="Добавить ещё" />
      </ActionBar>,
    );
  expect(at(layer('plain'))).toBe('132');
  expect(at(layer('count'))).toBe('176');
  expect(at(layer('gallery'))).toBe('190');
  expect(at(layer('upload'))).toBe('210');
  // The gallery and the queue fade into the dark rather than into `ink`: what is under them is a
  // wall of frames, and spec 2 keeps everything lying on a photograph dark in both themes.
  expect(layer('gallery')).toContain('rgba(11,11,18,0.96)');
  expect(layer('upload')).toContain('rgba(11,11,18,0.97)');
});

test('the gradient never catches a press, and the buttons over it do', () => {
  const layer = story(
    <ActionBar>
      <Button variant="primary" label="Создать" />
    </ActionBar>,
  );
  expect(layer).toContain('Создать');
  expect(layer).toContain('r-pointerEvents');
});

test('the header line is one height, and it is the spec’s', () => {
  expect(height.bar).toBe(44);
});
