import type { RefObject } from 'react';
import { useState } from 'react';

import { ApiError, deleteMedia, downloadAllMedia, type MediaItem } from '@/api';
import { maySaveToPhone, saveToPhone, shareFiles } from '@/lib/downloads';
import { type Failure, failure, said, saying } from '@/lib/failure';
import { removeFrames } from '@/lib/frames';
import { useStrings } from '@/lib/language';

/**
 * The three errands the picking mode runs on what is marked — keep them, hand them on, take them
 * out — and the one line the screen says while any of them is running.
 *
 * Apart from the feed because none of them is about drawing it: each is a walk over files that
 * outlives the press that started it, and all three share one «busy» and one banner.
 */
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
  /** What is marked, by record id. */
  picked: ReadonlySet<string>;
  /** And of those, the ones this person is allowed to take out for good. */
  deletable: readonly MediaItem[];
  /**
   * Whether the screen the errand was started from is still the one in front of somebody. An errand
   * over several files outlives the screen, and what must not happen is it going on unattended.
   */
  onScreen: RefObject<boolean>;
  /** What actually went, once a delete run is over — however far it got. */
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

  /** The grant, asked for at the moment it is needed, with this screen's place to say «no». */
  async function maySave(): Promise<boolean> {
    const granted = await maySaveToPhone();
    if (!granted) setNotice(said(s.error.galleryRefused));
    return granted;
  }

  /**
   * The links to the originals of what is marked. One ask for the lot rather than one per file,
   * which is what «скачать всё» has always cost and is why the route exists at all.
   *
   * ponytail: a link per marked record is the upgrade, and it would fix the expiry below too —
   * worth it the day a memory is big enough for the signing itself to be felt.
   */
  async function markedFiles(session: string) {
    return (await downloadAllMedia(session, memoryId)).filter((file) => picked.has(file.id));
  }

  /**
   * What is marked, one file after another onto the phone. A file that will not come down is
   * counted rather than fatal, because the person wanting several of them wants the rest of them
   * too. The count is the only progress there is: a save is atomic here.
   */
  async function save() {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      if (!(await maySave())) return;
      const files = await markedFiles(token);
      let failed = 0;
      for (const [index, file] of files.entries()) {
        // Between files and not mid-file: whoever walked out of the memory is not waiting on the
        // rest of it, and the one already coming down may as well land. What must not happen is
        // this going on unattended — see `onScreen`.
        if (!onScreen.current) return;
        setNotice(said(s.save.nth(index + 1, files.length)));
        try {
          await saveToPhone(file);
        } catch {
          // ponytail: the links are signed in one go and live about fifteen minutes, so a selection
          // too big to save inside that window loses its tail to this counter. Re-signing per file
          // is the upgrade, and the summary already tells the person to tap again.
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

  /**
   * The same armful handed on instead of kept — the left button of the picking mode. Each file goes
   * out as a local copy and never as the link the api signed: that one dies in a quarter of an hour,
   * so whoever it reached would get a refusal instead of a photograph.
   *
   * ponytail: one system sheet per file, because `expo-sharing` takes one file per call — several
   * frames means several sheets, one after the other, and leaving the screen is what breaks the
   * chain. A native share of many items is the upgrade; until then this at least hands every marked
   * frame on instead of silently dropping all but the first.
   */
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

  /**
   * What is marked, out of the memory for good — and only what this person may take out: their own
   * frames, or anybody's if they are the organizer. The api refuses the rest, so the sheet counts
   * what will actually go and never promises the rest.
   *
   * Whatever did go leaves the feed even if the run stopped halfway: the records are gone on the
   * server, and a feed still drawing them would open windows onto nothing.
   */
  async function drop() {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    // A frame somebody else already took out is gone all the same, and does not stop the run.
    const { gone, failure: refused } = await removeFrames(
      deletable,
      (item) => deleteMedia(token, memoryId, item.id),
      () => onScreen.current,
    );
    if (gone.size > 0) onGone(gone);
    // A 403 is the api saying this person may not take these out — its own words, beside the lock.
    if (refused !== undefined)
      setNotice(failure(refused, { 403: { text: saying(s.gallery.deleteDenied) } }));
    setBusy(false);
  }

  return { busy, notice, save, share, drop };
}
