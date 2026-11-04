import type { RefObject } from 'react';
import { useState } from 'react';
import { ApiError, deleteMedia, downloadAllMedia, type MediaItem } from '@/api';
import { maySaveToPhone, saveToPhone, shareFiles } from '@/lib/downloads';
import { type Failure, failure, said, saying } from '@/lib/failure';
import { removeFrames } from '@/lib/frames';
import { useStrings } from '@/lib/language';
export function useMarkedErrands({
  memoryId,
  token,
  picked,
  deletable,
  onScreen,
  onGone,
}: {
  memoryId: string;
  token: string | null;
  picked: ReadonlySet<string>;
  deletable: readonly MediaItem[];
  onScreen: RefObject<boolean>;
  onGone: (gone: ReadonlySet<string>) => void;
}): {
  busy: boolean;
  notice: Failure | null;
  save: () => Promise<void>;
  share: () => Promise<void>;
  drop: () => Promise<void>;
} {
  const s = useStrings();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Failure | null>(null);
  async function maySave(): Promise<boolean> {
    const granted = await maySaveToPhone();
    if (!granted) setNotice(said(s.error.galleryRefused));
    return granted;
  }
  async function markedFiles(session: string) {
    return (await downloadAllMedia(session, memoryId)).filter((file) => picked.has(file.id));
  }
  async function save() {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      if (!(await maySave())) return;
      const files = await markedFiles(token);
      let failed = 0;
      for (const [index, file] of files.entries()) {
        if (!onScreen.current) return;
        setNotice(said(s.save.nth(index + 1, files.length)));
        try {
          await saveToPhone(file);
        } catch {
          failed += 1;
        }
      }
      setNotice(
        said(
          failed === 0
            ? s.save.all(files.length)
            : s.save.some(files.length - failed, files.length),
        ),
      );
    } catch (e) {
      setNotice(e instanceof ApiError ? said(e.message) : said(s.save.failedAll));
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!token) return;
    setBusy(true);
    setNotice(said(s.viewer.sharing));
    try {
      await shareFiles(await markedFiles(token), () => onScreen.current);
      setNotice(null);
    } catch (e) {
      setNotice(e instanceof ApiError ? said(e.message) : said(s.viewer.shareFailed));
    } finally {
      setBusy(false);
    }
  }
  async function drop() {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    const { gone, failure: refused } = await removeFrames(
      deletable,
      (item) => deleteMedia(token, memoryId, item.id),
      () => onScreen.current,
    );
    if (gone.size > 0) onGone(gone);
    if (refused !== undefined)
      setNotice(failure(refused, { 403: { text: saying(s.gallery.deleteDenied) } }));
    setBusy(false);
  }
  return { busy, notice, save, share, drop };
}
