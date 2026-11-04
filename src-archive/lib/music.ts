import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { finishMusicUpload, type MusicTrackId, previewMusicTrack, startMusicUpload } from '@/api';
import { missingParts, uploadedParts } from '@/lib/upload/queue';
export type PickedTrack = {
  uri: string;
  name: string;
};
export async function sendOwnTrack(
  token: string,
  memoryId: string,
  track: PickedTrack,
): Promise<string> {
  const source = new File(track.uri);
  if (!source.exists || source.size === 0) throw new Error(`${track.name} cannot be read`);
  const size = source.size;
  const plan = await startMusicUpload(token, memoryId, size);
  const etags: Record<number, string> = {};
  for (const part of missingParts(size, plan.upload.part_size, etags)) {
    const link = plan.upload.parts.find((one) => one.part_number === part.number)?.url;
    if (link === undefined) throw new Error(`no link for part ${part.number}`);
    const handle = source.open();
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
export type Playing = {
  track: MusicTrackId;
  at: number;
} | null;
const TICK_MS = 500;
export type Preview = {
  toggle(track: MusicTrackId): Promise<void>;
  stop(): void;
};
export function createPreview(token: string, onChange: (playing: Playing) => void): Preview {
  let sounding: AudioPlayer | null = null;
  let ticker: ReturnType<typeof setInterval> | null = null;
  let wanted: MusicTrackId | null = null;
  function stop() {
    wanted = null;
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
    sounding?.pause();
    sounding?.remove();
    sounding = null;
    onChange(null);
  }
  async function toggle(track: MusicTrackId) {
    const was = wanted;
    stop();
    if (was === track) return;
    wanted = track;
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      const { url } = await previewMusicTrack(token, track);
      if (wanted !== track) return;
      const player = createAudioPlayer({ uri: url });
      sounding = player;
      player.play();
      onChange({ track, at: 0 });
      ticker = setInterval(() => {
        if (sounding !== player) return;
        const at = player.duration > 0 ? player.currentTime / player.duration : 0;
        if (at >= 1) stop();
        else onChange({ track, at });
      }, TICK_MS);
    } catch (e) {
      if (wanted !== track) return;
      stop();
      throw e;
    }
  }
  return { toggle, stop };
}
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
    toggle: (track) => preview.current?.toggle(track) ?? Promise.resolve(),
  };
}
