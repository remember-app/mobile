import ts from 'typescript';
import { expect, test } from 'vitest';

import { type ButtonVariant, DEFAULT_WIDE } from '@/kit/button';

/**
 * An action with words in it — a button as wide as its words, a chip — grows with the system type,
 * and a row that does not wrap has only one way to make room for it: past the edge of the screen,
 * where nobody can press it (TASK-365). So every row such an action stands in wraps, and what does
 * not fit moves under instead. A button that runs the width of its row is not one of them: it gives
 * way inside the row by itself — and squeezes whatever words share the row to nothing, so it shares
 * one with other buttons only.
 *
 * Read off the sources rather than a render, so a row nobody has drawn in a test is held to it too.
 * A row is a style with `flexDirection: 'row'`; the action counts wherever it lands — in a row of
 * the same file, or in a row of the part it is handed to through a slot (`children`, `above`, …).
 */

const sources = Object.entries(
  import.meta.glob<string>('@/{app,screens,kit}/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).map(([path, source]) => [path.replace(/^.*\/src\//, ''), source] as const);

type Row = { at: string; wraps: boolean };
type File = { path: string; tree: ts.SourceFile; styles: Map<string, string[]> };

const files: File[] = sources.map(([path, source]) => {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const styles = new Map<string, string[]>();
  const collect = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'StyleSheet.create') {
      const [sheet] = node.arguments;
      if (sheet && ts.isObjectLiteralExpression(sheet))
        for (const style of sheet.properties)
          if (ts.isPropertyAssignment(style)) {
            const name = style.name.getText(tree);
            styles.set(name, [...(styles.get(name) ?? []), style.initializer.getText(tree)]);
          }
    }
    ts.forEachChild(node, collect);
  };
  collect(tree);
  return { path, tree, styles };
});

const attribute = (element: ts.JsxOpeningLikeElement, name: string) =>
  element.attributes.properties.find(
    (one): one is ts.JsxAttribute => ts.isJsxAttribute(one) && one.name.getText() === name,
  );

/** The rows an element's own `style` makes it. */
function rowsOf(file: File, element: ts.JsxOpeningLikeElement): Row[] {
  const style = attribute(element, 'style')?.getText(file.tree) ?? '';
  return [...style.matchAll(/styles\.(\w+)/g)].flatMap(([, name]) => {
    const drawn = file.styles.get(name) ?? [];
    if (!drawn.some((one) => one.includes("flexDirection: 'row'"))) return [];
    return [
      { at: `${file.path} › ${name}`, wraps: drawn.every((one) => /flexWrap: 'wrap'/.test(one)) },
    ];
  });
}

/** The element a node is laid out in: the nearest one it is a child of, not its own tag. */
function parentElement(node: ts.Node): ts.JsxElement | undefined {
  for (let from = node, up = node.parent; up; from = up, up = up.parent)
    if (ts.isJsxElement(up) && from !== up.openingElement) return up;
  return undefined;
}

/** The props an expression writes into the markup as they came: `children`, `a ? b : c`, `a ?? b`. */
function written(expression: ts.Expression): ts.Identifier[] {
  if (ts.isIdentifier(expression)) return [expression];
  if (ts.isParenthesizedExpression(expression)) return written(expression.expression);
  if (ts.isConditionalExpression(expression))
    return [...written(expression.whenTrue), ...written(expression.whenFalse)];
  if (ts.isBinaryExpression(expression))
    return expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      ? written(expression.right)
      : [...written(expression.left), ...written(expression.right)];
  return [];
}

/**
 * Where each component puts what it is handed — `Banner.children`, `ActionBar.above` and so on —
 * with the rows that spot is a child of.
 */
const slots = new Map<string, Row[]>();
for (const file of files) {
  const visit = (node: ts.Node): void => {
    if (ts.isJsxExpression(node) && node.expression) {
      let owner: ts.Node | undefined = node.parent;
      while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
      const props =
        owner && ts.isFunctionDeclaration(owner) ? owner.parameters[0]?.name : undefined;
      const parent = parentElement(node);
      if (owner && ts.isFunctionDeclaration(owner) && owner.name && props && parent)
        for (const prop of written(node.expression))
          if (
            ts.isObjectBindingPattern(props) &&
            props.elements.some((one) => one.name.getText(file.tree) === prop.text)
          ) {
            const key = `${owner.name.text}.${prop.text}`;
            slots.set(key, [...(slots.get(key) ?? []), ...rowsOf(file, parent.openingElement)]);
          }
    }
    ts.forEachChild(node, visit);
  };
  visit(file.tree);
}

/**
 * How wide an action stands: as wide as its words — a chip, a button told so or of a variant that is
 * — or the width of its row. A button whose variant is picked on the fly can be either.
 */
function widths(file: File, element: ts.JsxOpeningLikeElement): { words: boolean; row: boolean } {
  if (element.tagName.getText(file.tree) === 'Chip') return { words: true, row: false };
  const wide = attribute(element, 'wide');
  if (wide) {
    const words = wide.initializer?.getText(file.tree) === '{false}';
    return { words, row: !words };
  }
  const variant = attribute(element, 'variant')?.initializer?.getText(file.tree) ?? "'secondary'";
  const runs = [...variant.matchAll(/['"](\w+)['"]/g)].map(
    ([, one]) => DEFAULT_WIDE[one as ButtonVariant],
  );
  return { words: runs.some((one) => !one), row: runs.some(Boolean) };
}

/**
 * The rows an action is laid out in: those of the element it is a child of — or, handed to a part
 * through a slot, those the part puts that slot in. Only the one it is a child of: a column in
 * between is what takes the squeeze, and the action inside it is only ever as wide as the column.
 */
function rowsAround(file: File, node: ts.Node): Row[] {
  for (let from = node, up = node.parent; up; from = up, up = up.parent) {
    if (ts.isJsxAttribute(up) && ts.isJsxAttributes(up.parent))
      return slots.get(`${up.parent.parent.tagName.getText(file.tree)}.${up.name.getText()}`) ?? [];
    if (ts.isJsxElement(up) && from !== up.openingElement)
      return [
        ...rowsOf(file, up.openingElement),
        ...(slots.get(`${up.openingElement.tagName.getText(file.tree)}.children`) ?? []),
      ];
  }
  return [];
}

/** Every button and chip in the app: how wide it stands, and the rows it stands in. */
const actions = files.flatMap((file) => {
  const found: { at: string; words: boolean; row: boolean; rows: Row[] }[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      ['Button', 'Chip'].includes(node.tagName.getText(file.tree))
    ) {
      const rows = rowsAround(file, ts.isJsxOpeningElement(node) ? node.parent : node);
      const line = file.tree.getLineAndCharacterOfPosition(node.getStart(file.tree)).line + 1;
      found.push({ at: `${file.path}:${line}`, ...widths(file, node), rows });
    }
    ts.forEachChild(node, visit);
  };
  visit(file.tree);
  return found;
});

test('every row that holds a button as wide as its words, or a chip, wraps', () => {
  const stuck = actions
    .filter(({ words }) => words)
    .flatMap(({ at, rows }) =>
      rows.filter((row) => !row.wraps).map((row) => `${at} stands in ${row.at}`),
    );
  expect(stuck).toEqual([]);
});

/** The rows where buttons the width of the row stand side by side, with no words between them. */
const BUTTON_ROWS = new Set([
  'kit/bars.tsx › layerRow',
  'app/memory/[id]/montage/[montageId]/done.tsx › actions',
]);

test('a button that runs the width of its row shares it with other buttons only, never with words', () => {
  // «Готово» in the edit modes of the labels and the roster, «Что сняли» and «Вернуть» each did,
  // and squeezed the words beside them to nothing on any type: beside words it is `wide={false}`.
  const squeezing = actions
    .filter(({ row }) => row)
    .flatMap(({ at, rows }) =>
      rows.filter((one) => !BUTTON_ROWS.has(one.at)).map((one) => `${at} stands in ${one.at}`),
    );
  expect(squeezing).toEqual([]);
});

test('the sweep sees the rows it is about, slots included', () => {
  // Without this the tests above pass on a sweep that has stopped finding anything.
  const seen = (width: 'words' | 'row') =>
    new Set(actions.filter((one) => one[width]).flatMap(({ rows }) => rows.map((row) => row.at)));
  for (const row of BUTTON_ROWS) expect(seen('row'), row).toContain(row);
  for (const row of [
    'screens/memory/label-sheets.tsx › head',
    'screens/memory/invite-sheet.tsx › link',
    'screens/memory/invite-sheet.tsx › chips',
    'screens/memory/frames-sheets.tsx › titleRow',
    'screens/memory/frames-sheets.tsx › dayHead',
    // Handed in through a slot: «Повторить» in a banner, «Снять» over the bottom layer.
    'kit/card.tsx › banner',
    'kit/bars.tsx › layerAbove',
  ])
    expect(seen('words'), row).toContain(row);
});
