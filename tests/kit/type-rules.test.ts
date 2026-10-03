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
  // where the kit grows it itself: `Text`; the unsaid part of a live line is a span inside a kit
  // `Text` and takes that one's size.
  const text = sources
    .filter(([, source]) => fromNative(source).some((name) => /^Text( as \w+)?$/.test(name)))
    .map(([path]) => path);
  expect(text.sort()).toEqual(['kit/montage-live.tsx', 'kit/text.tsx']);
  // Every field is the kit's field, and each of its three inputs stops at the kit's ceiling. An
  // input's cap is the same one everywhere, and an input asks the phone's scale anew when it changes:
  // it measures what it holds off its own view, and a size handed over in the props reached it a
  // commit late — the name on the memory's edit stayed as tall as at the old type (TASK-406).
  const inputs = sources
    .filter(([, source]) => fromNative(source).includes('TextInput'))
    .map(([path]) => path);
  expect(inputs).toEqual(['kit/field.tsx']);
  const own = (path: string) => sources.find(([at]) => at === path)?.[1] ?? '';
  const field = own('kit/field.tsx');
  expect(field.match(/<TextInput\b/g)).toHaveLength(3);
  expect(field.match(/maxFontSizeMultiplier=\{TYPE_MOST\}/g)).toHaveLength(3);
  // The words are grown by the kit and never by the platform (TASK-406): every text the platform
  // draws is handed its size already grown and told not to grow it again — a cap left to the
  // platform is out of its measure cache's key, and a text whose props stay the same through a
  // change of the system's type keeps the layout of the old one.
  const kit = own('kit/text.tsx');
  const platformTexts = kit.match(/<RNText\b/g)?.length ?? 0;
  expect(platformTexts).toBeGreaterThan(0);
  expect(kit.match(/allowFontScaling=\{false\}/g)).toHaveLength(platformTexts);
  // And nothing else opts out of the system's type.
  expect(
    sources
      .filter(([, source]) => /allowFontScaling/.test(source))
      .map(([path]) => path)
      .sort(),
  ).toEqual(['kit/text.tsx']);
});

/**
 * A box of a fixed height with words in it: the words grow with the system's type and the box does
 * not, so they run out of it — the six cells of the code on `LoginCode` did, at the largest type,
 * and the cards of the list, the strip of films and the templates did (TASK-375). Such a box takes
 * its height as a floor (`minHeight`). The ones below are what there is today, each with why it is
 * still a height; none of them is on a screen with a field. A new one fails here until it is a floor
 * or joins them with its reason — and one made a floor fails here until it leaves.
 */
const HELD: Record<string, string> = {
  // A cell `fitCell` sizes: its height is worked out from the type it holds, never under 44.
  'kit/calendar.tsx › day': 'fitCell',
  'kit/calendar.tsx › inline': 'fitCell',
  'kit/slider.tsx › inline': 'fitCell',
  // A picture's own box, the words laid over the photograph: the height is the picture's.
  'kit/montage-live.tsx › shotSmall': 'a 62 frame',
  'kit/rows.tsx › noteShot': 'a 34 frame',
  // A plate or a pill the layout draws to a height, not yet measured at the largest type.
  'kit/daymark.tsx › band': 'the day gap in the feed, felt at 44 — its words through a variable',
  'kit/daymark.tsx › mark': 'the day gap in the feed, 20',
  'kit/daymark.tsx › spineMark': 'the date on the spine',
  'kit/daymark.tsx › spinePill': 'the date on the spine',
  'kit/member.tsx › inline': 'the «+N» circle of a stack',
  'kit/member.tsx › pill': '«смотрят сейчас»',
  'kit/tile.tsx › ownSign': 'the 22 sign in the corner of one’s own frame, «!» alone',
  // The 28 pill the stage line carries under the bar — «ждёт» beside it, and the same pill saying
  // «остановился» in the block of a film that fell.
  'app/memory/[id]/montage/[montageId]/index.tsx › pill': 'the pill of the stage line',
  'app/memory/[id]/montage/[montageId]/index.tsx › stoppedPill': 'the same pill, stopped',
  // The 28 «готов» over the poster's scrub bar, which is itself a height the layout draws.
  'kit/card-montage.tsx › scrubPill': '«готов» on the poster',
  // The 26 ring at the head of a stage row — the one that holds the number while the stage waits.
  'kit/film.tsx › stageMark': 'the ring of a stage row',
};

type File = {
  path: string;
  tree: ts.SourceFile;
  heights: Set<string>;
  /** What a name drawn as `{face}` stands for, where the file writes that name as markup. */
  markup: Map<string, string>;
};

const HEIGHT = /(^|[^A-Za-z])height:/;

const files: File[] = sources.map(([path, source]) => {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const heights = new Set<string>();
  const markup = new Map<string, string>();
  // An object a style spreads in (`...CARD`) brings its height along with it.
  const tall = new Set<string>();
  const unwrap = (node: ts.Expression): ts.Expression =>
    ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  const declared = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      const value = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(value) && HEIGHT.test(value.getText(tree)))
        tall.add(node.name.text);
      if (ts.isJsxElement(value) || ts.isJsxFragment(value) || ts.isJsxSelfClosingElement(value))
        markup.set(node.name.text, value.getText(tree));
    }
    ts.forEachChild(node, declared);
  };
  declared(tree);
  const collect = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'StyleSheet.create') {
      const [sheet] = node.arguments;
      if (sheet && ts.isObjectLiteralExpression(sheet))
        for (const style of sheet.properties) {
          if (!ts.isPropertyAssignment(style)) continue;
          const drawn = style.initializer.getText(tree);
          const spread = [...drawn.matchAll(/\.\.\.(\w+)/g)].some(([, name]) => tall.has(name));
          if (HEIGHT.test(drawn) || spread) heights.add(style.name.getText(tree));
        }
    }
    ts.forEachChild(node, collect);
  };
  collect(tree);
  return { path, tree, heights, markup };
});

test('no box with words in it is held to a fixed height', () => {
  const fixed: string[] = [];
  for (const file of files) {
    // The words a child draws, the markup it names by a variable (`{face}`) included.
    const drawn = (child: ts.Node) => {
      const text = child.getText(file.tree);
      return [
        text,
        ...[...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => file.markup.get(name) ?? ''),
      ].join('\n');
    };
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
        const words = node.children.some((child) => /<(Text|RNText)\b/.test(drawn(child)));
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
 * Words that carry sense are never cut to a count of lines (TASK-400): a name, a date, a meta line, a
 * caption, the name of a track wrap at their spaces and the row or card they stand in grows down —
 * «Лиза Мороз…», «12–14 сентябр…», «Спокой…» were what large type left of them (TASK-377: «Отп…» on
 * `LoginCode` was the address the letter went to). A line is cut only where the spec cuts it itself
 * and the words are whole a tap away or read out whole — the designer's list — and where the kit
 * cut it before and the cut is left open, named in TASK-400's report. A new cut anywhere fails here,
 * and so does one of these that is taken away without leaving the list.
 */
const CUT: Record<string, number> = {
  // Cut by the spec, whole elsewhere. The story quoted back on the total, four lines (7.6, detail
  // 43; 10.6) — whole on the step it was written on.
  'app/memory/[id]/order/summary.tsx': 1,
  // …and the same story in its block on the screen of the film in the queue, two lines (spec 8,
  // `FilmQueued`) — whole on the step it was written on, and nowhere else.
  'app/memory/[id]/montage/[montageId]/index.tsx': 1,
  // The capsule's name and meta over the feed (7.1, detail 4; 10.6) — whole in the settings it
  // opens, and in what it is read out as.
  'kit/bars.tsx': 2,
  // A track's wish (7.7, detail 54; `MontageMusic`) — whole in the field its pencil unfolds; a
  // record under an opened stage, two lines (7.7, detail 56) — whole in the stage's journal.
  'kit/rows.tsx': 2,
  // A label's name in its row (7.7, detail 60) — whole in what the row is read out as.
  'kit/label.tsx': 1,
  // A film's name heading the order's total, past its smallest size (7.2, detail 79; the seventh
  // place, confirmed by chief) — whole a press away, on the sheet that renames it.
  'kit/name-heading.tsx': 1,
  // Cut by the kit, not by the spec: left open. Why a film fell over, one line on its card in the
  // strip — whole on the screen the card opens; wrapped, it would move the strip at the ordinary size.
  'kit/card-montage.tsx': 1,
  // The words of the 20 seam between two days of the feed (7.8, detail 65), which cannot grow.
  'kit/daymark.tsx': 1,
  // The reason on a frame the wizard dropped, in a pill across the tile.
  'kit/tile.tsx': 1,
  // A file's name, which has no space to wrap at (spec 3): on its line in the block of failures
  // (7.7, detail 51) and in the head of one's own frame's sheet (`SheetMyFrame`) — whole in what
  // either is read out as.
  'kit/upload.tsx': 1,
  'screens/mine/frame-sheet.tsx': 1,
  // What a stage came to, two lines under its name in the row (spec 8, `RowFilmStage`) — whole in
  // the journal of that stage, which is the one press further.
  'kit/film.tsx': 1,
};

test('words that carry sense are never cut to a count of lines, but for the lines the spec cuts', () => {
  const cut = Object.fromEntries(
    sources
      .map(
        ([path, source]) => [path, (source.match(/numberOfLines=\{\d+\}/g) ?? []).length] as const,
      )
      .filter(([, count]) => count > 0),
  );
  expect(cut).toEqual(CUT);
  // Nor is a line count handed on under another name: `Text` passes one on only inside `balance`.
  const handed = sources
    .filter(([path]) => path !== 'kit/text.tsx')
    .filter(([, source]) => /numberOfLines=\{(?!\d)/.test(source))
    .map(([path]) => path);
  expect(handed).toEqual([]);
});

/**
 * Spec 10.1 and 10.11: `faint` is under the floor of contrast, so words that are read never wear it —
 * «весь читаемый вторичный текст `muted`». It stays on what is unavailable (a contact just removed,
 * whose name and circle go out) and on the `@` in front of a name, which is a sign. A new `faint`
 * word anywhere fails here.
 */
const FAINT: Record<string, number> = {
  'kit/member.tsx': 4,
  'kit/field.tsx': 1,
  // The number of a stage nobody has come to, in the ring its row waits in: a number in a circle is
  // what «ждёт» looks like, and the five waiting rows must not be five identical grey rings.
  'kit/film.tsx': 1,
};

test('words that are read are never `faint`', () => {
  const found = Object.fromEntries(
    sources
      .map(([path, source]) => [
        path,
        (source.match(/tone=(?:"faint"|\{[^}]*'faint'[^}]*\})/g) ?? []).length,
      ])
      .filter(([, count]) => (count as number) > 0),
  ) as Record<string, number>;
  for (const [path, count] of Object.entries(found)) {
    expect(count, path).toBeLessThanOrEqual(FAINT[path] ?? 0);
  }
});

test('every field can be reached by a finger and by a screen reader', () => {
  // TASK-377: the code's one input lies over its six cells, and at opacity 0 iOS lets no finger
  // reach it and no screen reader find it — so once the keyboard was put away, a tap on the cells
  // brought nothing back. Its digits are see-through instead; the input itself is there.
  const field = sources.find(([path]) => path === 'kit/field.tsx')?.[1] ?? '';
  expect(field).not.toMatch(/opacity:\s*0\b/);
  expect(field).toMatch(/codeInput: \{ color: 'transparent' \}/);
});
