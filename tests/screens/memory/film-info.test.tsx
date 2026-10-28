import { expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

import { mounted, mountsTrees } from '@tests/helpers/renderer';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { Montage } from '@/api';
import { RowDo } from '@/kit';
import { FilmInfoSheet } from '@/screens/memory/film-info';
import { ru } from '@/strings';

/** `SheetFilmInfo` (spec 8) — who has watched the film, and whom its two irreversible doors are for. */

mountsTrees();

const person = (id: string) => ({ id, username: id, name: null });

const film: Montage = {
  id: 'f1',
  memory_id: 'm1',
  ordered_by: person('me'),
  status: 'ready',
  name: 'Ролик для родителей',
  template: 'parents',
  size_bytes: '48000000',
  duration_seconds: 60,
  params: {},
  error_text: null,
  created_at: new Date(2026, 8, 14, 12).toISOString(),
  video_url: 'https://r2.example/f1.mp4',
  poster_url: 'https://r2.example/f1.jpg',
  stages: null,
  // The organizer, a contributor and a viewer.
  watched_by: [person('me'), person('liza'), person('vera')],
};

async function sheet(mayEdit: boolean, over: Partial<Montage> = {}) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = mounted(
      TestRenderer.create(
        <FilmInfoSheet
          film={{ ...film, ...over }}
          memory={{ title: 'Свадьба Лизы и Марка', media_count: 120 }}
          people={5}
          mayEdit={mayEdit}
          onRename={() => {}}
          onRemove={() => {}}
          onClose={() => {}}
        />,
      ),
    );
  });
  return {
    words: tree.root
      .findAll((node) => node.type === Text)
      .map((node) => [node.props.children].flat().join('')),
    doors: tree.root.findAllByType(RowDo).map((node) => node.props.label),
  };
}

test('«Посмотрели» counts out of everybody in the memory, viewers too, and only the organizer is shown rename and delete', async () => {
  // Five people, two of them viewers: `member_count` says 3, and a viewer who watched made it «3 из 3».
  const organizer = await sheet(true);
  expect(organizer.words).toContain(ru.montage.live.doneOf(3, 5));
  expect(organizer.doors).toEqual([ru.montage.film.rename, ru.montage.film.remove]);
  expect((await sheet(false)).doors).toEqual([]);
});

test('a film the director chose the music for says so instead of naming tracks', async () => {
  // The music row is where a film's music is read back (spec 8, `SheetFilmInfo`). A director's order
  // names no track, so the choice itself stands there — the list's own quoting is for track names.
  const direct = await sheet(true, { params: { music_director: true } });
  expect(direct.words).toContain(ru.montage.directorChoice);
  expect(direct.words).not.toContain(ru.montage.film.noMusic);
  // A film cut to named tracks still lists them, quoted, the way it always did.
  const named = await sheet(true, { params: { music_tracks: ['warm', 'calm'] } });
  expect(named.words).toContain(
    ru.montage.film.tracks([ru.montage.track.warm, ru.montage.track.calm]),
  );
});
