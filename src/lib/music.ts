// «Свой трек с телефона» (doc-03, spec 8 step 3): the one file this app sends that is not material.
// It goes into R2 the way a photograph does — the api signs, the phone sends the bytes, the api is
// told they are there — and the order then names it by the key that comes back.
//
// Not the queue (`@/lib/upload/send`), and deliberately: that one exists because a gallery upload is
// interrupted by the tunnel, the lift and the app being swiped away, so it lives on disk, resumes
// part by part and words every way it can fail. A track is one small file picked and sent while
// somebody watches the button, and the api has no re-issue route for its links at all — so this one
// is a straight line, and a failure is the same button pressed again. The arithmetic of cutting a
// file into parts is shared with the queue all the same: `@/lib/upload/queue` is where it lives, and two
// copies of it could only ever disagree.
//
// The other half of this file is the shelf being listened to before a video is ordered — the same
// subject from the other end, so it lives here rather than in a module of its own.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';

import { finishMusicUpload, previewMusicTrack, startMusicUpload, type MusicTrackId } from '@/api';
import { missingParts, uploadedParts } from '@/lib/upload/queue';

/** The file as the picker handed it over: where it is on the phone, and what it is called. */
export type PickedTrack = { uri: string; name: string };

/**
 * Send one track and answer with its key in R2 — what goes into the order's `music_tracks`.
 *
 * Throws what the api throws (403 for anybody but the organizer, 413 over the file ceiling, 503
 * without a bucket) and a plain `Error` when R2 itself refuses a part; both come out of `@/api`'s
 * `errorMessage` as a line a screen can show. Nothing is written down anywhere: a track that did not
 * make it is simply not chosen, and the wizard still has the shelf.
 */
export async function sendOwnTrack(
  token: string,
  memoryId: string,
  track: PickedTrack,
): Promise<string> {
  const source = new File(track.uri);
  if (!source.exists || source.size === 0) throw new Error(`${track.name} cannot be read`);

  // Measured once, the way the queue does it: the slices have to line up with the links the api
  // signed against this number, and a file measured twice could answer differently the second time.
  const size = source.size;
  const plan = await startMusicUpload(token, memoryId, size);
  const etags: Record<number, string> = {};

  for (const part of missingParts(size, plan.upload.part_size, etags)) {
    const link = plan.upload.parts.find((one) => one.part_number === part.number)?.url;
    if (link === undefined) throw new Error(`no link for part ${part.number}`);

    const handle = source.open();
    // Typed as the handle hands it back rather than as a plain `Uint8Array`: a view over a
    // `SharedArrayBuffer` is not a body `fetch` will take, and the two say so differently.
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      handle.offset = part.start;
      bytes = handle.readBytes(part.length);
    } finally {
      handle.close();
    }

    const response = await fetch(link, { method: 'PUT', body: bytes });
    if (!response.ok) throw new Error(`storage refused part ${part.number} (${response.status})`);
    const etag = response.headers.get('etag');
    if (etag === null) throw new Error(`storage took part ${part.number} without a receipt`);
    etags[part.number] = etag;
  }

  const done = await finishMusicUpload(token, memoryId, plan.id, uploadedParts(etags));
  return done.key;
}

/**
 * «Послушать» (spec 8 step 3): which of the five is sounding and how far into it, 0…1 — the
 * waveform under the row's name is drawn off that number. Null is silence.
 */
export type Playing = { track: MusicTrackId; at: number } | null;

/** How often the progress is read off the player. Sixteen bars over two minutes move slower. */
const TICK_MS = 500;

/** One speaker for the whole shelf: playing anything is stopping whatever was playing before. */
export type Preview = {
  /** Play this one — or stop it, if it is the one already sounding. Throws what the api throws. */
  toggle(track: MusicTrackId): Promise<void>;
  /** Silence: the step being left, the wizard closing, a link that would not sign. */
  stop(): void;
};

/**
 * The listening, kept out of the screen so it can be tested without a phone: everything here talks
 * to the api and to one player, and says what is sounding through `onChange`.
 *
 * One at a time by construction — a second track cannot start without the first being released —
 * because two tracks over each other is not a thing anybody would ask for, and the api signs a link
 * per press anyway. Nothing is cached: an hour-long link held across a wizard that stands open is a
 * link that has quietly expired, and asking again costs one small request.
 */
export function createPreview(token: string, onChange: (playing: Playing) => void): Preview {
  let sounding: AudioPlayer | null = null;
  let ticker: ReturnType<typeof setInterval> | null = null;
  /**
   * What the last press asked for, held apart from the player: signing a link takes a moment, and a
   * press that lands inside that moment has to win over the one still in flight.
   */
  let wanted: MusicTrackId | null = null;

  function stop() {
    wanted = null;
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
    // `remove` and not `pause`: a paused player still holds the audio session and its own memory,
    // and there is nothing to resume here — the next press starts a track from its beginning.
    sounding?.remove();
    sounding = null;
    onChange(null);
  }

  async function toggle(track: MusicTrackId) {
    const was = wanted;
    // Whatever was sounding stops either way: pressing the same row again is the stop, pressing
    // another row is the switch, and both begin with silence.
    stop();
    if (was === track) return;
    wanted = track;

    try {
      // A phone lives on silent, and iOS plays nothing through the ringer switch unless it is told
      // otherwise. Said before each play rather than once at startup: this is the only sound the
      // app makes, so there is no mode for it to keep between wizards.
      await setAudioModeAsync({ playsInSilentMode: true });
      const { url } = await previewMusicTrack(token, track);
      // Something else was pressed while the link was being signed — that press owns the speaker.
      if (wanted !== track) return;

      const player = createAudioPlayer({ uri: url });
      sounding = player;
      player.play();
      onChange({ track, at: 0 });
      ticker = setInterval(() => {
        // A tick that outlived its own player: `stop` clears this, but the clock may already have
        // been on its way here when it did.
        if (sounding !== player) return;
        const at = player.duration > 0 ? player.currentTime / player.duration : 0;
        // A track running out is a stop nobody pressed, and the button says «Послушать» again.
        if (at >= 1) stop();
        else onChange({ track, at });
      }, TICK_MS);
    } catch (e) {
      // Nobody is waiting on this one any more: another row took the speaker while the link was
      // being signed, or the step itself went away and stopped everything. The press is dead, and
      // so is its failure — thrown on, it would word a banner over a track that is playing fine,
      // or over the step after this one, about music somebody walked away from (found in review).
      if (wanted !== track) return;
      // A link that would not sign leaves nothing sounding — and nothing pressed either, or the
      // next press on that same row would read as «stop this» and do nothing at all.
      stop();
      throw e;
    }
  }

  return { toggle, stop };
}

/**
 * The preview as a screen holds it. Tied to the life of whoever calls it, which is the whole of
 * «уход со шага музыки останавливает воспроизведение»: the music step is mounted while it is the
 * step and gone when it is not, and closing the wizard takes it with the screen.
 */
export function useTrackPreview(token: string | null): {
  playing: Playing;
  toggle: (track: MusicTrackId) => Promise<void>;
} {
  const [playing, setPlaying] = useState<Playing>(null);
  const preview = useRef<Preview | null>(null);

  useEffect(() => {
    if (token === null) return;
    const one = createPreview(token, setPlaying);
    preview.current = one;
    return () => {
      one.stop();
      preview.current = null;
    };
  }, [token]);

  return {
    playing,
    // Signed out, or pressed in the instant before the effect above ran: there is nothing to play
    // and nothing to report, which is not a failure the screen has to word.
    toggle: (track) => preview.current?.toggle(track) ?? Promise.resolve(),
  };
}
