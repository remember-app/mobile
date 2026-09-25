import ts from 'typescript';
import { expect, test } from 'vitest';

/**
 * TASK-377 — what keeps the words whole at every size of the system's type, read off the sources so
 * that a screen nobody has drawn in a test is held to it too. The ceilings themselves — how far each
 * role grows — are measured in `large-type.test.ts`; these are the ways around them.
 */

const sources = Object.entries(
  import.meta.glob<string>('@/{app,screens,kit}/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).map(([path, source]) => [path.replace(/^.*\/src\//, ''), source] as const);

/** What a file takes from React Native by name. */
const fromNative = (source: string) =>
  [...source.matchAll(/import\s*{([^}]*)}\s*from\s*'react-native';/g)].flatMap(([, names]) =>
    names
      .split(',')
      .map((name) => name.trim().replace(/^type\s+/, ''))
      .filter(Boolean),
  );

test('words reach the screen through the kit, where the ceiling is', () => {
  // The platform's own text grows as far as the phone asks — ×3.571 on iOS — so it is only drawn
  // where the kit sets the ceiling itself: `Text` and the segment's measured words; the unsaid part
  // of a live line is a span inside a kit `Text` and takes that one's.
  const text = sources
    .filter(([, source]) => fromNative(source).some((name) => /^Text( as \w+)?$/.test(name)))
    .map(([path]) => path);
  expect(text.sort()).toEqual(['kit/montage-live.tsx', 'kit/segment.tsx', 'kit/text.tsx']);
  // Every field is the kit's field, and each of its three inputs stops at the kit's ceiling.
  const inputs = sources
    .filter(([, source]) => fromNative(source).includes('TextInput'))
    .map(([path]) => path);
  expect(inputs).toEqual(['kit/field.tsx']);
  const field = sources.find(([path]) => path === 'kit/field.tsx')?.[1] ?? '';
  expect(field.match(/<TextInput\b/g)).toHaveLength(3);
  expect(field.match(/maxFontSizeMultiplier=\{TYPE_MOST\}/g)).toHaveLength(3);
  // And nothing opts out of the system's type altogether.
  expect(sources.filter(([, source]) => /allowFontScaling/.test(source))).toEqual([]);
});

/**
 * A box of a fixed height with words in it: the words grow with the system's type and the box does
 * not, so they run out of it — the six cells of the code on `LoginCode` did, at the largest type.
 * Such a box takes its height as a floor (`minHeight`). The ones below are what there is today, each
 * with why it is still a height; none of them is on a screen with a field. A new one fails here until
 * it is a floor or joins them with its reason — and one made a floor fails here until it leaves.
 */
const HELD: Record<string, string> = {
  // A cell `fitCell` sizes: its height is worked out from the type it holds, never under 44.
  'kit/calendar.tsx › day': 'fitCell',
  'kit/calendar.tsx › inline': 'fitCell',
  'kit/slider.tsx › inline': 'fitCell',
  // A picture's own box, the words laid over the photograph: the height is the picture's.
  'kit/card-memory.tsx › large': 'cover 340',
  'kit/card-memory.tsx › strip': 'mosaic 96, or its empty frame',
  'kit/card-montage.tsx › new': 'a poster card',
  'kit/card-montage.tsx › emptyBlock': 'the empty films block, 132',
  'kit/montage-order.tsx › poster': 'the summary poster, 136',
  'kit/montage-order.tsx › template': 'a template tile, 118',
  'kit/montage-live.tsx › shot': 'the frame on air',
  'kit/montage-live.tsx › shotSmall': 'a 62 frame',
  'kit/montage-live.tsx › wait': 'the frame on air, waiting',
  'kit/rows.tsx › noteShot': 'a 34 frame',
  // A plate or a pill the layout draws to a height, not yet measured at the largest type.
  'kit/badge.tsx › mark': 'badge 22',
  'kit/badge.tsx › tag': 'tag 28',
  'kit/bars.tsx › viewerPill': 'the viewer pill, 48',
  'kit/daymark.tsx › spineMark': 'the date on the spine',
  'kit/daymark.tsx › spinePill': 'the date on the spine',
  'kit/member.tsx › inline': 'the «+N» circle of a stack',
  'kit/member.tsx › pill': '«смотрят сейчас»',
  'kit/montage-live.tsx › filmAt': 'the film strip on air, 40',
};

type File = { path: string; tree: ts.SourceFile; heights: Set<string> };

const files: File[] = sources.map(([path, source]) => {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const heights = new Set<string>();
  const collect = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'StyleSheet.create') {
      const [sheet] = node.arguments;
      if (sheet && ts.isObjectLiteralExpression(sheet))
        for (const style of sheet.properties)
          if (
            ts.isPropertyAssignment(style) &&
            /(^|[^A-Za-z])height:/.test(style.initializer.getText(tree))
          )
            heights.add(style.name.getText(tree));
    }
    ts.forEachChild(node, collect);
  };
  collect(tree);
  return { path, tree, heights };
});

test('no box with words in it is held to a fixed height', () => {
  const fixed: string[] = [];
  for (const file of files) {
    const visit = (node: ts.Node): void => {
      if (ts.isJsxElement(node)) {
        const style = node.openingElement.attributes.properties.find(
          (one): one is ts.JsxAttribute => ts.isJsxAttribute(one) && one.name.getText() === 'style',
        );
        const written = style?.getText(file.tree) ?? '';
        const named = [...written.matchAll(/styles\.(\w+)/g)]
          .map(([, name]) => name)
          .filter((name) => file.heights.has(name));
        const inline = /[{,]\s*height:/.test(written);
        const words = node.children.some((child) =>
          /<(Text|RNText)\b/.test(child.getText(file.tree)),
        );
        if (words) {
          for (const name of named) fixed.push(`${file.path} › ${name}`);
          if (inline) fixed.push(`${file.path} › inline`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file.tree);
  }
  expect([...new Set(fixed)].sort()).toEqual(Object.keys(HELD).sort());
});

/**
 * On the way in and on every screen and sheet with a field, the words are never cut: a line that
 * does not fit wraps (TASK-377 — «Отп…» on `LoginCode` at the largest type was the address the
 * letter went to). What is still cut is the person's own — their name, nick and address on the
 * profile card, which the spec cuts with an ellipsis so the circle and the pencil never move.
 */
const CUT: Record<string, number> = { 'app/profile.tsx': 3 };

test('on the screens with a field, and on the way in, only the person’s own words are cut', () => {
  const typed = sources
    .filter(([path]) => !path.startsWith('kit/'))
    .filter(([, source]) => /<(Field|CodeField|TextArea|UsernameForm)\b/.test(source))
    .map(([path]) => path);
  expect(typed.length).toBeGreaterThan(8);
  const walked = [
    ...typed,
    'app/login.tsx',
    'app/consent.tsx',
    'screens/onboarding/head.tsx',
    'screens/memory/when.tsx',
  ];
  const cut = Object.fromEntries(
    sources
      .filter(([path]) => walked.includes(path))
      .map(([path, source]) => [path, (source.match(/numberOfLines=/g) ?? []).length] as const)
      .filter(([, count]) => count > 0),
  );
  expect(cut).toEqual(CUT);
});

test('every field can be reached by a finger and by a screen reader', () => {
  // TASK-377: the code's one input lies over its six cells, and at opacity 0 iOS lets no finger
  // reach it and no screen reader find it — so once the keyboard was put away, a tap on the cells
  // brought nothing back. Its digits are see-through instead; the input itself is there.
  const field = sources.find(([path]) => path === 'kit/field.tsx')?.[1] ?? '';
  expect(field).not.toMatch(/opacity:\s*0\b/);
  expect(field).toMatch(/codeInput: \{ color: 'transparent' \}/);
});
