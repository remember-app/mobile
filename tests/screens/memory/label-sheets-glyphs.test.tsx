import { afterEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ token: 'session' }) }));
// A text input listens on the browser's `document`, which a test renderer has none of; the name is
// handed to the sheet's `onSubmit` directly.
vi.mock('@/kit', async (original) => ({ ...(await original<typeof import('@/kit')>()), Field: () => null }));

import { Lock, Tag as TagIcon, TriangleAlert, Unlink, WifiOff } from 'lucide-react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { Banner, Button, ConfirmSheet, Icon, IconButton, RowLabel, type IconComponent } from '@/kit';
import { frame, label } from '@tests/helpers/labels';
import { LabelNewSheet, LabelSheets } from '@/screens/memory/label-sheets';
import { currentLanguage, setLanguage } from '@/lib/language';
import { en, ru, strings } from '@/strings';
import { mounted, mountsTrees } from '@tests/helpers/renderer';

/**
 * The banner of the labels sheets draws «no signal» only where the connection broke. Every answer
 * the api gave is about something else, and its glyph is picked by the status it came with — never
 * by the words, which change with the language: a 403 is rights, a 404 is whatever that route has
 * lost (the memory, or the label), anything else is a plain warning. Every errand of the sheets,
 * against every kind of failure.
 */

mountsTrees();

afterEach(async () => {
  vi.unstubAllGlobals();
  await setLanguage('ru');
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const best = label({ id: 'best', title: 'Лучшее', media_count: 0 });

/** The words the sheets are speaking right now, to find a button by. */
const now = () => strings[currentLanguage()];
type Sheets = TestRenderer.ReactTestRenderer;
const press = (tree: Sheets, run: () => void) => act(async () => run());
const button = (tree: Sheets, text: string) =>
  tree.root.findAllByType(Button).find((one) => one.props.label === text)!;
const icon = (tree: Sheets, text: string) =>
  tree.root.findAllByType(IconButton).find((one) => one.props.label === text)!;

/** One errand of the sheets: the request it sends, and how a person gets it sent. */
type Errand = {
  name: string;
  method: string;
  path: string;
  go: (tree: Sheets) => Promise<void>;
  /** What this route's 404 is about — the memory, or the label in its path. */
  gone: [IconComponent, string];
  /** The words of its 403: the sheet's own where it has them, the api's otherwise. */
  denied: string;
};

const memoryGone: [IconComponent, string] = [Unlink, ru.memory.gone];
const labelGone: [IconComponent, string] = [TagIcon, ru.labels.gone];

const ERRANDS: Errand[] = [
  { name: 'reading the list', method: 'GET', path: '/labels', go: async () => {}, gone: memoryGone, denied: 'forbidden' },
  {
    name: 'filing into a label',
    method: 'POST',
    path: '/labels/best/media',
    go: (tree) => press(tree, () => tree.root.findByType(RowLabel).props.onPress()),
    gone: labelGone,
    denied: 'forbidden',
  },
  {
    name: 'making a label',
    method: 'POST',
    path: '/labels',
    go: async (tree) => {
      await press(tree, () => button(tree, now().labels.newOne).props.onPress());
      await press(tree, () => tree.root.findByType(LabelNewSheet).props.onSubmit('Общее', 1, true));
    },
    gone: memoryGone,
    denied: ru.labels.sharedDenied,
  },
  {
    name: 'renaming a label',
    method: 'PATCH',
    path: '/labels/best',
    go: async (tree) => {
      await press(tree, () => button(tree, now().labels.edit).props.onPress());
      await press(tree, () => icon(tree, now().labels.rename('Лучшее')).props.onPress());
      await press(tree, () => tree.root.findByType(LabelNewSheet).props.onSubmit('Ящик', 2, true));
    },
    gone: labelGone,
    denied: 'forbidden',
  },
  {
    name: 'deleting a label',
    method: 'DELETE',
    path: '/labels/best',
    go: async (tree) => {
      await press(tree, () => button(tree, now().labels.edit).props.onPress());
      await press(tree, () => icon(tree, now().labels.remove('Лучшее')).props.onPress());
      await press(tree, () => tree.root.findByType(ConfirmSheet).props.onConfirm());
    },
    gone: labelGone,
    denied: 'forbidden',
  },
];

/** The sheets over one marked frame, with `errand`'s request answered by `answer` and the rest fine. */
async function refused(errand: Errand, answer: () => Response | 'offline') {
  vi.stubGlobal('fetch', async (url: string, init: { method?: string }) => {
    const method = init.method ?? 'GET';
    if (method === errand.method && url.endsWith(`/memories/m1${errand.path}`)) {
      const said = answer();
      if (said === 'offline') throw new TypeError('Network request failed');
      return said;
    }
    return json(method === 'GET' ? [best] : best);
  });
  let tree!: Sheets;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(<LabelSheets memoryId="m1" frames={[frame('a')]} onFiled={() => {}} onClose={() => {}} />),
    );
  });
  await errand.go(tree);
  return tree.root.findAllByType(Banner).map((one) => [one.findByType(Icon).props.icon, one.props.text]);
}

test.each(ERRANDS)('$name: only a broken connection is «no signal»', async (errand) => {
  expect(await refused(errand, () => 'offline')).toEqual([[WifiOff, ru.error.offline]]);
});

test.each(ERRANDS)('$name: a 403 is about rights and wears the lock', async (errand) => {
  expect(await refused(errand, () => json({ error: 'forbidden' }, 403))).toEqual([[Lock, errand.denied]]);
});

test.each(ERRANDS)('$name: a 404 is what that route has lost, not the connection', async (errand) => {
  expect(await refused(errand, () => json({ error: 'not found' }, 404))).toEqual([errand.gone]);
});

test.each(ERRANDS)('$name: any other refusal is the api’s words beside a plain warning', async (errand) => {
  expect(await refused(errand, () => json({ error: 'no such media in this memory' }, 400))).toEqual([
    [TriangleAlert, 'no such media in this memory'],
  ]);
  expect(await refused(errand, () => json({ error: 'internal' }, 500))).toEqual([[TriangleAlert, 'internal']]);
});

test('the glyph follows the status and not the words: in English the same refusals keep theirs', async () => {
  await setLanguage('en');
  const [list, filing, making] = ERRANDS;
  expect(await refused(list, () => json({ error: 'not found' }, 404))).toEqual([[Unlink, en.memory.gone]]);
  expect(await refused(filing, () => json({ error: 'not found' }, 404))).toEqual([[TagIcon, en.labels.gone]]);
  expect(await refused(making, () => json({ error: 'forbidden' }, 403))).toEqual([[Lock, en.labels.sharedDenied]]);
  expect(await refused(making, () => 'offline')).toEqual([[WifiOff, en.error.offline]]);
});
