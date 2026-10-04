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

import { entry } from '@tests/helpers/journal';
import { MONTAGE_STAGES } from '@/api';
import { marksOf, reasonWord, stoppedWord, whyTaken } from '@/lib/montage/journal';
import { en, ru } from '@/strings';

/**
 * One record of the journal read out as a sentence: why a frame was taken, why it was passed over,
 * and the marks that stand beside it.
 */

describe('the record in words', () => {
  test('a decision on a piece of a video names the seconds taken', () => {
    const took = entry(1, {
      decision: 'take',
      source_from_seconds: 4,
      source_to_seconds: 7,
      story_part: 2,
    });
    expect(marksOf(took, ru)).toEqual(['Беру 0:04–0:07', 'часть 2']);
    expect(marksOf(took, en)).toEqual(['Taking 0:04–0:07', 'part 2']);
  });

  test('one out of a burst says how big the burst was', () => {
    expect(marksOf(entry(1, { decision: 'take', series_size: 4 }), ru)).toEqual(['Взял 1 из 4']);
    // A «series» of one is one frame, and saying «взял 1 из 1» about it would be noise.
    expect(marksOf(entry(1, { decision: 'take', series_size: 1 }), ru)).toEqual(['Беру']);
  });

  test('a frame passed over carries why', () => {
    expect(marksOf(entry(1, { decision: 'skip', reason: 'duplicate' }), ru)).toEqual([
      'Мимо',
      'Дубль',
    ]);
    expect(marksOf(entry(1, { decision: 'skip', reason: 'unreadable' }), en)).toEqual([
      'Passing',
      'Would not open',
    ]);
  });

  test('a frame the director left out says so, and its own words about why are the thought', () => {
    const left = entry(1, {
      decision: 'skip',
      reason: 'left_out',
      media_id: 'f1',
      thought: 'собака не про этот вечер',
    });
    expect(marksOf(left, ru)).toEqual(['Мимо', 'Не в истории']);
    expect(marksOf(left, en)).toEqual(['Passing', 'Not in the story']);
  });

  test('a frame the organizer asked for says so beside «Беру», not instead of it', () => {
    const asked = entry(1, { decision: 'take', reason: 'included' });
    expect(marksOf(asked, ru)).toEqual(['Беру', 'Взят по слову организатора']);
    expect(marksOf(asked, en)).toEqual(['Taking', 'Taken at the organizer’s word']);
    expect(whyTaken(asked, ru)).toBe('Взят по слову организатора');
    expect(marksOf({ ...asked, story_part: 2 }, ru)).toEqual([
      'Беру',
      'Взят по слову организатора',
      'часть 2',
    ]);
  });

  test('a take with no reason, or one this app does not know, wears no reason at all', () => {
    // «Не подошёл» beside «Беру» would be the record arguing with itself.
    for (const reason of [null, 'shaky_pan', 'blur']) {
      const took = entry(1, { decision: 'take', reason });
      expect(marksOf(took, ru), `${reason}`).toEqual(['Беру']);
      expect(whyTaken(took, ru)).toBe(undefined);
    }
    // And the organizer's word is about a take: a thought or a pass does not wear it.
    expect(whyTaken(entry(1, { reason: 'included' }), ru)).toBe(undefined);
    expect(whyTaken(entry(1, { decision: 'skip', reason: 'included' }), ru)).toBe(undefined);
  });

  test('a thought with nothing settled in it wears no pill', () => {
    expect(marksOf(entry(1), ru)).toEqual([]);
  });

  /**
   * The worker's vocabulary is open — the api puts no check on that column — so the day it learns a
   * new word for «this one is no good», the app has to keep drawing the record rather than a blank
   * or a raw code.
   */
  test('a reason this app has never heard of is still said in words', () => {
    expect(reasonWord('shaky_pan', ru)).toBe(ru.montage.live.reason.other);
    expect(reasonWord('shaky_pan', en)).toBe(en.montage.live.reason.other);
    expect(reasonWord(null, ru)).toBe(undefined);
    // The code is the model's own words: a name off the object's prototype is just another unknown
    // word, not an object or a function handed to a `<Text>`.
    for (const code of ['__proto__', 'constructor', 'toString']) {
      expect(reasonWord(code, ru)).toBe(ru.montage.live.reason.other);
    }
  });

  /**
   * Every code the dictionary holds, each against the word it must be said in — the words written
   * out here rather than read back out of the dictionary. A test that asks the dictionary whether it
   * agrees with itself passes whatever the words are, and that is how `no_room` sat here drawing a
   * phrase nobody writes: a code in this list, a phrase in both halves of the dictionary, and no
   * screen anywhere to prove the worker still writes it (api `docs/journal.md`, «Причины мимо» —
   * `no_room` «это `left_out`»).
   *
   * So the words are pinned, and this list is the whole of them: a wrong word, a missing key, or a
   * key added for a code nobody writes each fail here rather than reaching somebody's screen.
   */
  const WORDS: [string, string, string][] = [
    ['blur', 'Смазан', 'Blurred'],
    ['exposure', 'Свет не тот', 'The light is off'],
    ['unreadable', 'Не открылся', 'Would not open'],
    ['duplicate', 'Дубль', 'A double'],
    ['excluded', 'Убрали при заказе', 'Left out at the order'],
    ['left_out', 'Не в истории', 'Not in the story'],
    ['included', 'Взят по слову организатора', 'Taken at the organizer’s word'],
  ];

  test('every reason in the dictionary is said in its own word, in both languages', () => {
    for (const [code, russian, english] of WORDS) {
      expect(reasonWord(code, ru), code).toBe(russian);
      expect(reasonWord(code, en), code).toBe(english);
      // And none of them is the catch-all dressed up as a word: that word is for a code nobody knows.
      expect(reasonWord(code, ru), code).not.toBe(ru.montage.live.reason.other);
      expect(reasonWord(code, en), code).not.toBe(en.montage.live.reason.other);
    }
    // Every one of them its own word, in each language.
    expect(new Set(WORDS.map(([, russian]) => russian)).size).toBe(WORDS.length);
    expect(new Set(WORDS.map(([, , english]) => english)).size).toBe(WORDS.length);
  });

  test('the dictionary holds these codes and nothing else', () => {
    // The other side of the same promise: a key nobody writes is a phrase in the code for a thing
    // that is not there. `other` is the one extra — the word for a code this app has not heard of.
    for (const [name, s] of [
      ['ru', ru],
      ['en', en],
    ] as const) {
      expect(Object.keys(s.montage.live.reason).sort(), name).toEqual(
        [...WORDS.map(([code]) => code), 'other'].sort(),
      );
    }
  });

  test('the five stages of the journal are named in both languages', () => {
    for (const code of MONTAGE_STAGES) {
      expect(ru.montage.stage[code], `ru ${code}`).toBeTruthy();
      expect(en.montage.stage[code], `en ${code}`).toBeTruthy();
      expect(ru.montage.stageHead[code], `ru head ${code}`).toBeTruthy();
      expect(en.montage.stageHead[code], `en head ${code}`).toBeTruthy();
      expect(ru.montage.progress[code], `ru progress ${code}`).toBeTruthy();
      expect(en.montage.progress[code], `en progress ${code}`).toBeTruthy();
    }
    expect(ru.montage.live.stageOf(3, 5)).toBe('Этап 3 из 5');
    expect(ru.montage.live.leftAbout(8)).toBe('осталось ≈ 8 мин');
    expect(ru.montage.live.minutes(4)).toBe('4 мин');
    // Why a making stopped is said by the worker's own code, and a code outside the dictionary
    // reads as the general one rather than as itself.
    expect(ru.montage.live.stopped.no_material).toBeTruthy();
    expect(stoppedWord(undefined, en)).toBe(en.montage.live.stopped.other);
  });
});
