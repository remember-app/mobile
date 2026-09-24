import { afterEach, expect, test, vi } from 'vitest';

vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
vi.mock('@/auth', () => ({ useAuth: () => ({ token: 'session' }) }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (run: () => (() => void) | undefined) => useEffect(run, [run]),
    useIsFocused: () => true,
    useLocalSearchParams: () => ({}),
    useRouter: () => ({ push: () => {}, setParams: () => {} }),
  };
});
// The player and what it saves with are native; a strip of cards never raises either.
vi.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));
vi.mock('@/orientation', () => ({ useTurnsWithPhone: () => {} }));
vi.mock('@/downloads', () => ({
  maySaveToPhone: () => false,
  saveToPhone: async () => {},
  saveAndShare: async () => {},
  shareFile: async () => {},
}));

import TestRenderer, { act } from 'react-test-renderer';

import type { Memory, Montage } from '@/api';
import { CardMontage } from '@/kit';
import { Films } from '@/memory/films';
import { ru } from '@/strings';
import { mountsTrees } from '@/test-renderer';

/**
 * The strip of films over montages ordered before the music became a list. An old row names its one
 * track in `music_track_id` (a shelf id) or `music_track_key` (a file of the organizer's own), and
 * has no `music_tracks` at all; the api still hands those out, and the card has to say what it was
 * cut to without falling over on the missing list.
 */

mountsTrees();

afterEach(() => vi.unstubAllGlobals());

const film = (id: string, params: Montage['params']): Montage => ({
  id,
  memory_id: 'm1',
  ordered_by: 'me',
  status: 'ready',
  duration_seconds: 90,
  params,
  error_text: null,
  created_at: '2026-06-01T10:00:00.000Z',
  video_url: 'https://cdn/v.mp4',
  poster_url: null,
});

async function strip(montages: Montage[]) {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(montages), { status: 200 }));
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Films id="m1" memory={{ role: 'organizer' } as Memory} />);
  });
  // What each card says it was made of, past the day it was ordered on.
  return tree.root
    .findAllByType(CardMontage)
    .map((card) => (card.props.meta as string).split(' · ').slice(1));
}

test('a montage that names its one track the old way still says what it was cut to', async () => {
  const cards = await strip([
    film('shelf', { music_track_id: 'calm', orientation: 'portrait' }),
    film('own', { music_track_key: 'music/7f3a' }),
    film('bare', {}),
    film('new', { music_tracks: ['bright', 'music/9c1d'], orientation: 'landscape' }),
  ]);

  // The old shelf id has its word, the old own file is «Свой трек», and a card with none says less.
  expect(cards).toEqual([
    [ru.montage.orientation.portrait, ru.montage.track.calm],
    [ru.montage.ownTrackShort],
    [],
    [ru.montage.orientation.landscape, ru.montage.track.bright, ru.montage.ownTrackShort],
  ]);
});
