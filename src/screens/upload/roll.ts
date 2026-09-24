// `expo-media-library/legacy` and not the package root: in SDK 57 the root re-exports
// `getAssetsAsync` only to throw, and the replacement hands back lazy asset *handles* whose uri and
// capture time are a native round trip each — one per tile in a grid of thousands. The legacy call
// answers with the whole plain row (id, uri, filename, mediaType, creationTime) in one go, which is
// also the shape `@/lib/media-window` was written against.
// ponytail: legacy goes away in some later SDK; the day it does, this screen moves to `Query` and
// pays for the uris with `getInfo()`.
import * as MediaLibrary from 'expo-media-library/legacy';
import { useEffect, useState } from 'react';

import { useStrings } from '@/lib/language';

/**
 * The phone's own camera roll, read whole: whether this app may look at it at all, and everything
 * it holds if it may. Nothing here knows what the roll is for — the cutting into days, the picking
 * and the sending are the screen's.
 */

/**
 * Photos and videos, and nothing else — the same list twice on purpose. It is what the grid asks
 * the library for, and on Android 13+ it is also what the phone asks the person for, so this app
 * never turns up wanting their voice recordings. `app.json` declares the matching pair.
 */
const WANTED = ['photo', 'video'] as const;

/** Big enough that the first page fills the screen, small enough that it arrives quickly. */
const PAGE = 500;

export function useRoll(): {
  access: MediaLibrary.PermissionResponse | null;
  /** Ask the phone itself — the button's own errand, never a thing done on the way in. */
  ask: () => Promise<MediaLibrary.PermissionResponse>;
  granted: boolean;
  /** A handful of photos handed over instead of the roll, which the screen has to say out loud. */
  limited: boolean;
  assets: MediaLibrary.Asset[];
  /** Still arriving: the roll is read page by page and a count taken halfway through lies. */
  reading: boolean;
  /** A gallery that would not open at all — this app's own wording, never the api's. */
  error: string | null;
  /** Read it from the top again: a retry, or a grant that has just been widened. */
  again: () => void;
  /** Widen a `limited` grant. Whatever it changed, the library is read again from the top. */
  chooseMore: () => Promise<void>;
} {
  const s = useStrings();
  // Checked on mount, asked for only on the button — that is the difference between knowing
  // whether we may look and looking. Nothing below runs until `granted`.
  const [access, ask] = MediaLibrary.usePermissions({ granularPermissions: [...WANTED] });
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [reading, setReading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped whenever the library must be read from the top again: a retry, or a wider grant.
  const [rereads, setRereads] = useState(0);

  const granted = access?.granted ?? false;
  // iOS and Android 14 both let somebody hand over a handful of photos instead of the roll. Said
  // out loud (`UploadLimited`), because otherwise a day comes up counting three frames out of the
  // sixty that were shot on it, and the grant is the only thing that would explain it.
  const limited = access?.accessPrivileges === 'limited';

  useEffect(() => {
    if (!granted) return;
    let live = true;
    setAssets([]);
    setError(null);
    setReading(true);

    void (async () => {
      try {
        let after: string | undefined;
        // The whole library, newest first, one page at a time. All of it and not the first page:
        // the days are cut out of what is in hand, and an event two months back sits behind however
        // many photos were taken since — an unread tail would leave the event's own days off the
        // top of the screen without saying so.
        // ponytail: a huge camera roll spends a few seconds on this. If that ever bites, page only
        // until the window is passed — but the window belongs to `@/lib/media-window`, so that stop
        // condition has to come from there and not from a second copy of the day maths here.
        do {
          const page = await MediaLibrary.getAssetsAsync({
            first: PAGE,
            after,
            mediaType: [...WANTED],
            sortBy: ['creationTime'],
          });
          if (!live) return;
          setAssets((have) => have.concat(page.assets));
          after = page.hasNextPage ? page.endCursor : undefined;
        } while (after !== undefined);
      } catch {
        // Not `errorMessage`: that one is worded for the api and would blame the network for a
        // phone that would not open its own gallery.
        if (live) setError(s.upload.cannotRead);
      } finally {
        if (live) setReading(false);
      }
    })();

    return () => {
      live = false;
    };
    // `s` is deliberately out of it: re-running this would read the whole camera roll again to
    // re-word one line, and on a big library that is seconds of paging.
  }, [granted, rereads]);

  return {
    access,
    ask,
    granted,
    limited,
    assets,
    reading,
    error,
    again: () => setRereads((n) => n + 1),
    chooseMore: async () => {
      await MediaLibrary.presentPermissionsPickerAsync([...WANTED]).catch(() => {});
      setRereads((n) => n + 1);
    },
  };
}
