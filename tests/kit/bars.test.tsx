import { expect, test, vi } from 'vitest';

const { system } = vi.hoisted(() => ({ system: { fontScale: 1 } }));

// The system's type size, turned by the test: the wizard's «Отмена» is drawn by it.
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    useWindowDimensions: () => ({ width: 375, height: 667, scale: 2, fontScale: system.fontScale }),
  };
});

import { rule } from '@tests/helpers/css';
import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { ChevronLeft, SquareCheckBig, Trash2, User, X } from 'lucide-react-native';
import { cloneElement } from 'react';
import { Text as RNText, StyleSheet, View, type ViewStyle } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { ActionBar, AppBar, Board, type Footer, GlassBar, ViewerBar, WizardBar } from '@/kit/bars';
import { StepScale } from '@/kit/bits';
import { Button, IconButton } from '@/kit/button';
import { Icon } from '@/kit/icon';
import { WatchingPill } from '@/kit/member';
import { allDifferent, story } from '@/kit/story';
import { Text } from '@/kit/text';
import { height, setTheme, themes } from '@/theme';

/** Spec 7.1 — the frame of a screen: the board, the bar at the top, the layer at the bottom. */

mountsTrees();

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
      cancel={{ label: 'Отмена', onPress: () => {} }}
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

/**
 * Spec 7.1, detail 3 — «Отмена» on large type. Up to ×1.2 of the system's type it is the word, 14 /
 * 600, 10 a side and hung 10 past the margin; from the next size up (iOS 1.235, Android 1.3) a round
 * 44 with an «x» 22, still read out as «Отмена», and both side blocks close from 74 to 44.
 */
const wizardAt = async (fontScale: number, variant: 'step' | 'summary' = 'step') => {
  system.fontScale = fontScale;
  const pressed: string[] = [];
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <WizardBar
          step={2}
          steps={4}
          label="Шаг 2 из 4"
          variant={variant}
          back={
            <IconButton icon={ChevronLeft} label="Назад" onPress={() => pressed.push('back')} />
          }
          cancel={
            variant === 'summary'
              ? undefined
              : { label: 'Отмена', onPress: () => pressed.push('cancel') }
          }
        />,
      ),
    );
  });
  system.fontScale = 1;
  const root = tree.root;
  const flat = (node: TestRenderer.ReactTestInstance) =>
    StyleSheet.flatten(node.props.style) as ViewStyle;
  return {
    pressed,
    word: root.findAllByType(Button),
    round: root.findAllByType(IconButton).filter((one) => one.props.label === 'Отмена'),
    back: root.findAllByType(IconButton).filter((one) => one.props.label === 'Назад'),
    sides: root
      .findAll(
        (one) =>
          one.type === View && ['flex-start', 'flex-end'].includes(String(flat(one).alignItems)),
      )
      .map((one) => flat(one).width),
    flat,
  };
};

test('up to ×1.2 «Отмена» is the word at 14, with 64 of its 74 block to stand in', async () => {
  for (const scale of [0.85, 1, 1.118, 1.15, 1.1999, 1.2]) {
    const bar = await wizardAt(scale);
    expect(bar.round, `×${scale}`).toHaveLength(0);
    expect(bar.word).toHaveLength(1);
    const [word] = bar.word;
    expect(word.props).toMatchObject({ variant: 'quiet', label: 'Отмена', labelRole: 'controlSm' });
    expect(StyleSheet.flatten(word.findByType(RNText).props.style)).toMatchObject({
      fontSize: 14,
      fontFamily: 'Onest_600SemiBold',
      color: themes.dark.color.muted,
    });
    expect(StyleSheet.flatten(word.props.style)).toEqual({
      paddingHorizontal: 10,
      marginRight: -10,
    });
    expect(bar.sides).toEqual([74, 74]);
    // A quiet button 44 tall — the spec's, and a finger's — and a transparent one: no fill of its own.
    const button = word.findAll((one) => one.props.accessibilityRole === 'button')[0];
    const drawn = StyleSheet.flatten(button.props.style({ pressed: false })) as ViewStyle;
    expect(drawn.minHeight).toBe(44);
    expect(drawn.backgroundColor).toBeUndefined();
    await act(async () => word.props.onPress());
    expect(bar.pressed).toEqual(['cancel']);
  }
});

test('past ×1.2 it is a round 44 with an «x» 22, read out as «Отмена», and both blocks close to 44', async () => {
  for (const scale of [1.2001, 1.21, 1.235, 1.3, 2, 3.571]) {
    const bar = await wizardAt(scale);
    expect(bar.word, `×${scale}`).toHaveLength(0);
    expect(bar.round).toHaveLength(1);
    const [round] = bar.round;
    expect(round.props).toMatchObject({
      icon: X,
      label: 'Отмена',
      glyph: { size: 22, stroke: 1.9 },
    });
    expect(round.props.size).toBeUndefined();
    expect(round.props.tone).toBeUndefined();
    expect(StyleSheet.flatten(round.props.style)).toEqual({ marginRight: -10 });
    expect(round.findByType(Icon).props).toMatchObject({
      size: 22,
      stroke: 1.9,
      color: themes.dark.color.muted,
    });
    const pill = round.findAll((one) => one.props.accessibilityRole === 'button')[0];
    expect(pill.props.accessibilityLabel).toBe('Отмена');
    // Round, 44 across, and transparent: a glyph on the bar and not a button on a plate.
    expect(StyleSheet.flatten(pill.props.style({ pressed: false }))).toMatchObject({
      width: 44,
      height: 44,
      borderRadius: 22,
    });
    expect(StyleSheet.flatten(pill.props.style({ pressed: false })).backgroundColor).toBe(
      'transparent',
    );
    expect(bar.sides).toEqual([44, 44]);
    await act(async () => round.props.onPress());
    expect(bar.pressed).toEqual(['cancel']);
  }
});

test('«Назад» is the same on any type, and the total closes its blocks with the rest', async () => {
  const [small, large] = [await wizardAt(1), await wizardAt(3.571)];
  for (const bar of [small, large]) {
    expect(bar.back).toHaveLength(1);
    expect(bar.back[0].props.icon).toBe(ChevronLeft);
    expect(bar.back[0].findByType(Icon).props.size).toBe(20);
  }
  // Nothing on the right of the total, but the same blocks, so the counter does not move between steps.
  const summary = await wizardAt(3.571, 'summary');
  expect(summary.round).toHaveLength(0);
  expect(summary.word).toHaveLength(0);
  expect(summary.sides).toEqual([44, 44]);
  expect((await wizardAt(1, 'summary')).sides).toEqual([74, 74]);
});

/** The wizard's bar drawn at a type size, whole, so its rows can be read in the order they stand. */
const wizardTree = async (
  fontScale: number,
  props: Partial<Parameters<typeof WizardBar>[0]> = {},
) => {
  system.fontScale = fontScale;
  let tree!: TestRenderer.ReactTestRenderer;
  const bar = (
    <WizardBar
      step={2}
      steps={4}
      label="Шаг 2 из 4"
      title="Как собрать"
      note="Без музыки или один-несколько треков."
      back={<IconButton icon={ChevronLeft} label="Назад" />}
      cancel={{ label: 'Отмена', onPress: () => {} }}
      {...props}
    />
  );
  await act(async () => {
    tree = mounted(TestRenderer.create(bar));
  });
  system.fontScale = 1;
  const flat = (node: TestRenderer.ReactTestInstance) =>
    StyleSheet.flatten(node.props.style) as ViewStyle & Record<string, unknown>;
  return {
    tree,
    flat,
    rerender: async (scale: number) => {
      system.fontScale = scale;
      await act(async () => tree.update(cloneElement(bar)));
      system.fontScale = 1;
    },
    /** The two blocks either side of the counter, and the counter, with whether they stand in that order. */
    parts: () => {
      const [left, right] = tree.root.findAll(
        (one) =>
          one.type === View &&
          ['flex-start', 'flex-end'].includes(String(flat(one).alignItems)) &&
          typeof flat(one).width === 'number',
      );
      const counter = tree.root.find((one) => one.type === Text && one.props.role === 'label');
      const all = tree.root.findAll(() => true);
      const inOrder =
        all.indexOf(left) < all.indexOf(counter) && all.indexOf(counter) < all.indexOf(right);
      return { left, counter, right, inOrder };
    },
    /** The block that carries a piece of the bar's words, with its own margins. */
    around: (words: TestRenderer.ReactTestInstance) =>
      tree.root.findAll(
        (one) =>
          one.type === View &&
          flat(one).marginHorizontal === 16 &&
          one.findAll((inner) => inner === words).length > 0,
      )[0],
  };
};

test('the bar’s row is «Назад», the counter, then «Отмена» — the counter between them, muted and centred', async () => {
  for (const scale of [1, 3.571]) {
    const { parts, flat } = await wizardTree(scale);
    const { left, counter, right, inOrder } = parts();
    expect(inOrder).toBe(true);
    expect(
      left.findAllByType(IconButton).map((one) => one.props.label),
      `×${scale}`,
    ).toEqual(['Назад']);
    expect(counter.props).toMatchObject({ role: 'label', tone: 'muted', children: 'Шаг 2 из 4' });
    // Everything the two blocks leave, the counter takes, and it is set centred in it, in figures
    // of one width so that «Шаг 1 из 4» and «Шаг 4 из 4» do not move.
    expect(flat(counter)).toMatchObject({ flex: 1, textAlign: 'center' });
    expect(flat(counter).fontVariant).toEqual(['tabular-nums']);
    // «Назад» stands at the left of its block and «Отмена» at the right of its own.
    expect(flat(left).alignItems).toBe('flex-start');
    expect(flat(right).alignItems).toBe('flex-end');
    expect(right.findAllByProps({ accessibilityLabel: 'Отмена' }).length).toBeGreaterThan(0);
  }
});

test('under the row: the scale 12 down, the heading 18 down inside the margins — 12 where there is no scale — and the note 10 under it', async () => {
  const step = await wizardTree(1);
  const heading = step.tree.root.find((one) => one.type === Text && one.props.role === 'display');
  // The heading is the screen's heading for a screen reader, and the bar's — the body scrolls.
  expect(heading.props).toMatchObject({ accessibilityRole: 'header', children: 'Как собрать' });
  // The scale stands 12 under the row, inside the margins like everything else in a bar.
  const scale = step.tree.root.findByType(StepScale);
  expect(step.flat(scale)).toMatchObject({ marginTop: 12, marginHorizontal: 16 });
  expect(step.flat(step.around(heading))).toMatchObject({ marginTop: 18, marginHorizontal: 16 });
  const note = step.tree.root.find((one) => one.type === Text && one.props.role === 'note');
  expect(note.props.tone).toBe('muted');
  expect(step.flat(note)).toMatchObject({ marginTop: 10 });

  const total = await wizardTree(1, { variant: 'summary' });
  const totalHeading = total.tree.root.find(
    (one) => one.type === Text && one.props.role === 'display',
  );
  expect(total.flat(total.around(totalHeading))).toMatchObject({
    marginTop: 12,
    marginHorizontal: 16,
  });
});

test('the type size changed on the way turns «Отмена» from the word to the round «x» and back, and the blocks with it', async () => {
  const { parts, flat, rerender } = await wizardTree(1);
  const at = () => {
    const { left, right } = parts();
    return {
      widths: [flat(left).width, flat(right).width],
      word: right.findAllByType(Button).length,
      round: right.findAllByType(IconButton).length,
    };
  };
  expect(at()).toEqual({ widths: [74, 74], word: 1, round: 0 });
  await rerender(2);
  expect(at()).toEqual({ widths: [44, 44], word: 0, round: 1 });
  await rerender(1.2);
  expect(at()).toEqual({ widths: [74, 74], word: 1, round: 0 });
  await rerender(1.2001);
  expect(at()).toEqual({ widths: [44, 44], word: 0, round: 1 });
});

test('in English «Cancel» is the same word in the same place, and the round «x» is still called «Cancel»', async () => {
  for (const [scale, kind] of [
    [1.2, 'word'],
    [1.3, 'round'],
  ] as const) {
    const { parts } = await wizardTree(scale, { cancel: { label: 'Cancel', onPress: () => {} } });
    const { right } = parts();
    expect(right.findAllByProps({ accessibilityLabel: 'Cancel' }).length, kind).toBeGreaterThan(0);
    expect(right.findAllByType(kind === 'word' ? Button : IconButton)).toHaveLength(1);
  }
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

test('the viewer’s pill wears the layout’s hairline and reads its second line at the layout’s 66% paper', () => {
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
  // «21:47 · Марк Ковалёв» is `rgba(245,243,238,.66)`, and never the 45% the meta dot is drawn in:
  // a line at 45% is unreadable over a bright frame.
  // Read off the element that carries the words: the sheet of compiled rules holds every colour any
  // part drawn so far in this file used, so the rule existing somewhere says nothing about this line.
  const second = /class="([^"]*)"[^>]*>21:47 · Марк Ковалёв</.exec(pill)?.[1] ?? '';
  expect(second).toContain(rule('color:rgba(245,243,238,0.66)'));
  expect(pill).not.toContain('rgba(255,255,255,0.45)');
});

test('the date in the viewer’s pill is the night’s paper and not the photograph’s white', async () => {
  // Spec 7.1, detail 5 and 10.10: «13 сентября» is `#F5F3EE`, in daylight as well — the bar is
  // pinned to the night because it lies on the photograph.
  const bar = <ViewerBar date="13 сентября" meta="21:47 · Марк Ковалёв" />;
  const dateOf = (markup: string) => markup.match(/class="([^"]*)">13 сентября</)?.[1];
  const paper = rule('color:rgba(245,243,238,1.00)');
  expect(dateOf(story(bar))).toContain(paper);
  await setTheme('light');
  expect(dateOf(story(bar))).toContain(paper);
  await setTheme('dark');
});

test('the pill in the middle of it is a button where it leads somewhere, and wears no chevron either way', () => {
  // Spec 7.1, detail 5 and rule 9 of spec 1: the whole capsule opens the frame's own sheet, and it
  // says so by being the capsule — an arrow in it would only take room from the date and the name.
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
  expect(opens).not.toContain('data-glyph');
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
  // — so it is not pressed, and announces itself as a heading.
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

test('the capsule wears no chevron, whether it opens something, takes every frame or only names', () => {
  // Rule 9 of spec 1: a central capsule is a button by being the capsule, and an arrow in it only
  // takes room from the name. The two round buttons are left off, so any glyph here is the capsule's.
  const capsule = (title: string, onCapsule?: () => void) =>
    story(
      <GlassBar
        title={title}
        meta="12–14 сентября · 6 человек"
        capsuleLabel={`${title}. Настройки воспоминания и люди`}
        onCapsule={onCapsule}
      />,
    );
  // The door of the feed, «выбрать все» of `FramesPicking`, and the plate of `Upload`.
  const drawn = [
    capsule('Свадьба Лизы и Марка', () => {}),
    capsule('Выбрано 4', () => {}),
    capsule('Ваши кадры'),
  ];
  for (const one of drawn) expect(one).not.toContain('data-glyph');
  // The name is the capsule's first line on its own, cut only by the capsule's edge.
  expect(drawn[0]).toMatch(/r-textOverflow[^>]*>Свадьба Лизы и Марка</);
});

test('nothing in the product draws a `chevron-down`, so there is no second place for one to come back', () => {
  // Spec 1, rule 9: «`chevron-down` в продукте не встречается вовсе». Swept over the sources rather
  // than named per screen: what would bring it back is the next capsule written by copying an old one.
  const sources = Object.entries(
    import.meta.glob<string>('@/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
  );
  expect(sources.length).toBeGreaterThan(50);
  for (const [path, source] of sources) expect(source, path).not.toMatch(/\bChevronDown\b/);
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
