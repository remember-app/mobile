import { describe, expect, test, vi } from 'vitest';

// `@/lib/montage/journal` reaches `@/api`, which asks `@/lib/language` which language to word a
// failure in, and that one stands on two native expo modules vitest has nothing to run — the same
// two lines `tests/api/api.test.ts` carries, for the same reason. `expo-router` is stood in for as
// well: the hook in that folder asks it whether its screen is in front, and the mock in
// `vitest.setup.ts` only answers for `useFocusEffect`.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));
vi.mock('expo-router', () => ({ useFocusEffect: () => {}, useIsFocused: () => true }));

import { entry, idsOf, page, run, serving, stage } from '@tests/helpers/journal';
import { isFresh, NO_JOURNAL, pull, pullOlder } from '@/lib/montage/journal';

/**
 * Reading the journal: the cursor, the chasing of `has_more`, and what a page does to what is
 * already held — including a montage that started over while somebody was watching.
 */

describe('pull — the first read', () => {
  test('takes the newest page, and does not chase the history behind it', async () => {
    // `has_more` on a read with no cursor is about the journal *behind* the page — older records,
    // not news. Chasing it with `after` would ask for what is already held and get nothing back.
    const api = serving([page([7, 8, 9], { has_more: true })]);
    const journal = await pull(NO_JOURNAL, api.ask);

    expect(api.asked).toEqual([{}]);
    expect(idsOf(journal)).toEqual([9, 8, 7]);
    expect(journal.cursor).toBe(9);
    expect(journal.oldest).toBe(7);
    // That `has_more` is what the stage screen's «scroll further back» is offered on.
    expect(journal.hasOlder).toBe(true);
    expect(journal.status).toBe('processing');
  });

  test('draws the line under everything that was already there', async () => {
    const api = serving([page([7, 8, 9]), page([10], { has_more: false })]);
    const opened = await pull(NO_JOURNAL, api.ask);
    // Everything in the first answer stands finished; what lands afterwards is said out loud.
    expect(isFresh(opened, entry(9))).toBe(false);
    const later = await pull(opened, api.ask);
    expect(isFresh(later, entry(10))).toBe(true);
    expect(later.settled).toBe(9);
  });

  test('an empty journal leaves every record that ever lands counted as new', async () => {
    // A montage still in the queue answers with nothing at all — and it is not an error.
    const api = serving([page([]), page([1])]);
    const opened = await pull(NO_JOURNAL, api.ask);
    expect(opened.settled).toBe(null);
    expect(opened.entries).toEqual([]);

    const later = await pull(opened, api.ask);
    expect(isFresh(later, entry(1))).toBe(true);
    // Still no cursor to ask after, so the second read is a first read again — and must not move
    // the line it drew: the screen has been open the whole time.
    expect(api.asked).toEqual([{}, {}]);
    expect(later.settled).toBe(null);
  });
});

describe('pull — reading it live', () => {
  test('a batch bigger than one page arrives whole, in one poll and without a hole', async () => {
    // The case the api's own rule is written for: between two polls the «разбор кадров» stage
    // writes a record per file — six hundred of them — and a page holds two hundred. Taking the
    // freshest two hundred would move the cursor past the four hundred in the middle for good.
    const api = serving([
      page(run(1, 200), { has_more: true }),
      page(run(201, 400), { has_more: true }),
      page(run(401, 600), { has_more: false }),
    ]);
    const opened = { ...NO_JOURNAL, status: 'processing' as const, cursor: 0, settled: 0 };
    const journal = await pull(opened, api.ask);

    expect(api.asked).toEqual([{ after: 0 }, { after: 200 }, { after: 400 }]);
    expect(journal.entries).toHaveLength(600);
    // Newest first, every id exactly once, nothing missing in the middle.
    expect(idsOf(journal)).toEqual(run(1, 600).reverse());
    expect(journal.cursor).toBe(600);
  });

  test('the same records arriving twice are held once', async () => {
    const api = serving([page([1, 2, 3]), page([2, 3, 4])]);
    const opened = await pull(NO_JOURNAL, api.ask);
    const journal = await pull(opened, api.ask);

    expect(idsOf(journal)).toEqual([4, 3, 2, 1]);
  });

  test('a page that moves nothing ends the poll rather than asking forever', async () => {
    // A route that answers `has_more` while handing back nothing new would otherwise be asked
    // again and again inside the one poll.
    const api = serving([page([1, 2]), page([], { has_more: true }), page([], { has_more: true })]);
    const opened = await pull(NO_JOURNAL, api.ask);
    const journal = await pull(opened, api.ask);

    expect(api.asked).toHaveLength(2);
    expect(journal.cursor).toBe(2);
  });

  test('a read that breaks halfway keeps the cursor where it was', async () => {
    // All or nothing per poll: the pages that did arrive are dropped with the one that did not, so
    // the next poll asks from the same place and the hole never opens.
    const pages = [page([1, 2], { has_more: true })];
    let at = 0;
    const ask = async () => {
      const answer = pages[at++];
      if (!answer) throw new Error('offline');
      return answer;
    };
    const opened = { ...NO_JOURNAL, status: 'processing' as const, cursor: 0, settled: 0 };

    await expect(pull(opened, ask)).rejects.toThrow('offline');
    // What the screen is holding is untouched — the hook is what puts the «связь пропала» word on
    // it, and it puts nothing else there.
    expect(opened.cursor).toBe(0);
    expect(opened.entries).toEqual([]);
  });

  test('the narrowing rides along on every page of the poll', async () => {
    const api = serving([page([5], { has_more: true }), page([6])]);
    const opened = { ...NO_JOURNAL, status: 'processing' as const, cursor: 4, settled: 4 };
    await pull(opened, api.ask, { stage: 'directing' });

    expect(api.asked).toEqual([
      { stage: 'directing', after: 4 },
      { stage: 'directing', after: 5 },
    ]);
  });

  test('files and watchers come off the answer: the files pile up, the watchers are replaced', async () => {
    const file = {
      id: 'f1',
      kind: 'video' as const,
      uploaded_by: 'u1',
      captured_at: null,
      duration_seconds: 12.5,
      thumbnail_url: null,
      places: [
        { start_seconds: 0, duration_seconds: 2.25 },
        { start_seconds: 12.5, duration_seconds: 3 },
      ],
    };
    const api = serving([
      page([1], { files: [file], viewers: [{ id: 'u1', username: 'anya' }] }),
      page([2], {
        files: [{ ...file, id: 'f2', places: [] }],
        viewers: [{ id: 'u2', username: 'mark' }],
      }),
    ]);
    const journal = await pull(await pull(NO_JOURNAL, api.ask), api.ask);

    // A file met three hundred records ago is still the one a record points at, so files are kept;
    // who is watching is only ever true of this moment, so watchers are not.
    expect(Object.keys(journal.files).sort()).toEqual(['f1', 'f2']);
    expect(journal.files.f1.places).toHaveLength(2);
    expect(journal.viewers).toEqual([{ id: 'u2', username: 'mark' }]);
  });
});

describe('pullOlder', () => {
  test('asks from the oldest record held and keeps what came before it', async () => {
    const api = serving([page([8, 9]), page([5, 6, 7], { has_more: true })]);
    const opened = await pull(NO_JOURNAL, api.ask);
    const journal = await pullOlder(opened, api.ask);

    expect(api.asked[1]).toEqual({ before: 8 });
    expect(idsOf(journal)).toEqual([9, 8, 7, 6, 5]);
    // The cursor does not follow the reader backwards — the next poll still asks for news.
    expect(journal.cursor).toBe(9);
    expect(journal.oldest).toBe(5);
    expect(journal.hasOlder).toBe(true);
  });

  test('has nothing to page back from until something has been read', async () => {
    const api = serving([]);
    expect(await pullOlder(NO_JOURNAL, api.ask)).toBe(NO_JOURNAL);
    expect(api.asked).toEqual([]);
  });
});
