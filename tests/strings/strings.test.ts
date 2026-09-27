/// <reference types="vite/client" />
import { expect, test } from 'vitest';

import { en, ru } from '@/strings';

// The typecheck already refuses a key with only one set. What it cannot see is a Russian value left
// as its English placeholder, how Russian counts, and a screen that never asked the dictionary at
// all — which is the one this file is here to catch on the next screen somebody writes.

test('every key says something different in each language', () => {
  const flat = (set: object, prefix = ''): [string, unknown][] =>
    Object.entries(set).flatMap(([key, value]) =>
      typeof value === 'object' && value !== null
        ? flat(value, `${prefix}${key}.`)
        : [[`${prefix}${key}`, value]],
    );
  const english = new Map(flat(en));
  const same = flat(ru).filter(([key, value]) => english.get(key) === value);
  // Three pairs are meant to match. Each language names itself in its own language — and the
  // template for short video is named after the three sites it is cut for, which are trademarks
  // and the same word in every language there is.
  expect(same.map(([key]) => key)).toEqual([
    'montage.template.short_form',
    'language.ru',
    'language.en',
  ]);
});

test('Russian counts in three forms, English in two', () => {
  expect([1, 2, 5, 11, 21, 104].map(ru.memory.frames)).toEqual([
    '1 кадр',
    '2 кадра',
    '5 кадров',
    '11 кадров',
    '21 кадр',
    '104 кадра',
  ]);
  expect([1, 2, 5].map(ru.memory.people)).toEqual(['1 человек', '2 человека', '5 человек']);
  expect([1, 2].map(en.memory.frames)).toEqual(['1 frame', '2 frames']);
  expect([1, 2].map(en.memory.people)).toEqual(['1 person', '2 people']);
});

test('the music step counts its tracks in the language’s own forms and says the ceiling of fifty in words', () => {
  // The count over «Выбрано» (spec 7.7, detail 54): 1 трек, 2 трека, 5 треков, 21 трек.
  expect([1, 2, 5, 11, 21, 22, 50].map(ru.montage.tracksPicked)).toEqual([
    '1 трек',
    '2 трека',
    '5 треков',
    '11 треков',
    '21 трек',
    '22 трека',
    '50 треков',
  ]);
  expect([1, 2, 50].map(en.montage.tracksPicked)).toEqual(['1 track', '2 tracks', '50 tracks']);
  expect(ru.montage.nothingAdded).toBe('ничего не добавлено');
  expect(en.montage.nothingAdded).toBe('nothing added');
  // What a person is told at the 51st, one sentence with the ceiling in it and what to do about it.
  expect(ru.montage.tracksFull(50)).toBe(
    'В ролик берут не больше 50 треков — уберите один из выбранных, чтобы добавить другой.',
  );
  expect(en.montage.tracksFull(50)).toBe(
    'A film takes at most 50 tracks — remove one of the chosen to add another.',
  );
  // After «не больше» the number stands in the genitive: 1 трека, 2 треков, 21 трека, 25 треков.
  expect([1, 2, 5, 21, 25].map((n) => ru.montage.tracksFull(n).split(' — ')[0])).toEqual([
    'В ролик берут не больше 1 трека',
    'В ролик берут не больше 2 треков',
    'В ролик берут не больше 5 треков',
    'В ролик берут не больше 21 трека',
    'В ролик берут не больше 25 треков',
  ]);
});

test('the sheet that deletes a memory counts its people after «всех», and the others’ frames in three forms', () => {
  // «У всех 21 участника», «у всех 5 участников»: after «всех» the number stands in the genitive.
  expect([3, 5, 11, 21, 104].map((n) => ru.settings.deleteText(n).split(' — ')[0])).toEqual([
    'Оно исчезнет у всех 3 участников',
    'Оно исчезнет у всех 5 участников',
    'Оно исчезнет у всех 11 участников',
    'Оно исчезнет у всех 21 участника',
    'Оно исчезнет у всех 104 участников',
  ]);
  expect(ru.settings.deleteText(2)).toContain('у обоих участников');
  expect(ru.settings.deleteText(1)).not.toContain('участник');
  expect(en.settings.deleteText(1)).not.toContain('people');
  expect([1, 3, 358].map(ru.settings.deleteOthers)).toEqual([
    '1 кадр сюда принесли другие',
    '3 кадра сюда принесли другие',
    '358 кадров сюда принесли другие',
  ]);
  expect([1, 2].map(en.settings.deleteOthers)).toEqual([
    'Other people brought 1 frame here',
    'Other people brought 2 frames here',
  ]);
});

test('the upload screen holds its words for a file it could not get, and names iCloud for itself', () => {
  // On a real phone this line was read as «prone's gallery» (TASK-419). The dictionary never said
  // it — and these are the exact words, so a typo in them fails here and not on somebody's screen.
  expect(en.upload.unreadable).toBe('Could not be read from the phone’s gallery');
  expect(ru.upload.unreadable).toBe('Телефон не смог прочитать из галереи');
  // A frame in iCloud is its own state and its own reason, in both languages — never the phone's
  // failure to read something it can read perfectly well once it is here.
  expect(en.upload.fromCloud).toBe('The frame is coming down from iCloud');
  expect(ru.upload.fromCloud).toBe('Кадр подгружается из iCloud');
  expect(en.upload.iCloud).toBe('Could not be brought down from iCloud');
  expect(ru.upload.iCloud).toBe('Не удалось скачать из iCloud');
  // And nothing else this screen says in English misspells the phone.
  const said = Object.values(en.upload).filter((line): line is string => typeof line === 'string');
  expect(said.filter((line) => /prone/i.test(line))).toEqual([]);
});

/**
 * Every route file, read as text — the idiom `tests/routes/memory/screen.test.ts` explains at length: this
 * project has no renderer, and what is worth pinning here is answered by the source anyway.
 *
 * `_layout.tsx` is the one screen left out, and on purpose: its `Stack.Screen options.title`
 * strings are never drawn (`headerShown` is false across the app), so they are chrome and not
 * something anybody reads.
 *
 * `src/screens/` is swept with the routes, for the reason `tests/routes/screen-theme.test.tsx`
 * gives: what lives there is screen-sized pieces standing outside `src/app` only because
 * everything inside it is a route, and the rule they keep is the routes' own.
 */
const screens = Object.entries(
  import.meta.glob<string>('@/{app,screens}/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).filter(([path]) => !path.endsWith('_layout.tsx'));

/** The props a person actually reads out of, or has read out to them. */
const TEXT_PROP =
  /\b(label|title|text|caption|hint|placeholder|confirmLabel|cancelLabel|playLabel|submitLabel|accessibilityLabel)="/g;

test('no screen writes its own words — every readable prop comes from the dictionary', () => {
  // A floor near the real count — 42 files as this is written — and not `> 0`: a pattern that
  // quietly stops matching half the tree leaves every case below passing over nothing, which is
  // how the upload screen's four messages slipped out of this sweep when they moved to
  // `src/screens/upload/message.tsx`.
  expect(screens.length).toBeGreaterThan(38);
  const hardcoded = screens.flatMap(([path, source]) =>
    (source.match(TEXT_PROP) ?? []).map((hit) => `${path}: ${hit}…"`),
  );
  expect(hardcoded).toEqual([]);
});
