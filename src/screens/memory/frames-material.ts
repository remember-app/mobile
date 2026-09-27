import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  errorMessage,
  type Label,
  listLabels,
  listMedia,
  listMembers,
  type MediaItem,
  type Member,
} from '@/api';
import { keepReady, stillPreparing } from '@/lib/frames';

/**
 * What a memory holds, read and kept fresh: the material, the roster over it and the labels it is
 * filed under. Apart from the feed because none of it is drawing — it is when to read, what a read
 * may overwrite, and what to do with one that comes back too late.
 */

/**
 * How long the feed waits before looking again while the worker is still making something. A
 * thumbnail takes it seconds, so this is about the time somebody spends noticing the frame is not
 * finished yet.
 */
const WHILE_PREPARING_MS = 3000;

export function useMaterial({
  memoryId,
  token,
  onLabels,
  hidden = false,
}: {
  memoryId: string;
  token: string | null;
  /**
   * The labels as they came back, for whoever holds a filter that may name one that has gone. Left
   * off, the labels are not read at all — «Мои кадры» files nothing.
   */
  onLabels?: (all: Label[]) => void;
  /** One's own hidden frames too — «Мои кадры» shows them; the shared feed never does. */
  hidden?: boolean;
}): {
  items: MediaItem[] | null;
  roster: Member[] | null;
  labels: Label[];
  error: string | null;
  loading: boolean;
  /** Read it again — loudly for a pull, quietly for the loop while the worker is finishing. */
  read: (quiet?: boolean) => void;
  readLabels: () => void;
  /** The feed written by this screen itself: a frame deleted, a box filed. */
  wrote: (change: (have: MediaItem[] | null) => MediaItem[] | null) => void;
} {
  // null means «not loaded yet», the distinction the montage block draws too: a reload after a
  // delete keeps the feed on screen instead of flashing the spinner over it.
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [roster, setRoster] = useState<Member[] | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * How many times this screen has written the feed itself — a frame deleted, a label filed. That
   * answer is newer than any quiet read already in flight, and such a read landing afterwards would
   * put the api's older snapshot back over it: the deleted frame would come back, and with nothing
   * left developing in that snapshot the loop below would stop and never read again. So a quiet read
   * carries the count it started under and drops its answer when that has moved (the films strip
   * keeps the same guard for the same reason).
   */
  const writes = useRef(0);

  const read = useCallback(
    // `quiet` belongs to the re-read below: that one happens on its own every few seconds, and it
    // must not light the pull-to-refresh spinner over a feed somebody is looking at, nor blank it
    // back to «Loading…» on the one read that fails.
    (quiet = false) => {
      if (!token) return;
      if (!quiet) {
        setError(null);
        setLoading(true);
      }
      // The listing carries neither a role nor a name, and this screen needs both: who may delete
      // what, and who brought the frame that is open or the strip that is grouped by them. The
      // roster answers all of it in one read.
      const startedAt = writes.current;
      Promise.all([listMedia(token, memoryId, { hidden }), listMembers(token, memoryId)])
        .then(
          ([media, members]) => {
            // Stale by the time it landed — see `writes`. A read somebody asked for is never stale.
            if (quiet && writes.current !== startedAt) return;
            // A quiet read is looking for what the worker has finished, and it must not disturb
            // what was already finished: `keepReady` holds every `ready` record's own object, so
            // the urls behind the frames on screen do not move and nothing is fetched twice.
            setItems((have) => (quiet ? keepReady(have, media) : media));
            setRoster(members);
            setError(null);
          },
          (e: unknown) => {
            if (!quiet) setError(errorMessage(e));
          },
        )
        .finally(() => {
          if (!quiet) setLoading(false);
        });
    },
    [token, memoryId, hidden],
  );

  /**
   * The labels, read on their own rather than as a third hand in the listing above. Three reasons,
   * and each of them is why this is not in `read`: the quiet re-read runs every three seconds while
   * the worker is finishing something and a box does not move on its own; a labels read that will
   * not come back must not put an error over a feed that is perfectly fine — the row simply is not
   * offered; and this is read again at the one moment the boxes actually change, which is the labels
   * sheet closing over this very screen (spec 10.8.2: the row answers a box made, renamed, deleted
   * or filled without the app being restarted).
   */
  const readLabels = useCallback(() => {
    if (!token || !onLabels) return;
    listLabels(token, memoryId).then(
      (all) => {
        setLabels(all);
        onLabels(all);
      },
      () => {},
    );
  }, [token, memoryId, onLabels]);

  // On focus rather than on mount, the way the home screen does it: what is drawn here changes on
  // the worker's side, and the signed urls die in a quarter hour, so a screen that read once when it
  // was first opened is showing whatever was true then.
  useFocusEffect(
    useCallback(() => {
      read();
      readLabels();
    }, [read, readLabels]),
  );

  // And the same reason again with nobody navigating: a record turns `ready` while this screen is
  // open and in front, and until this loop existed nothing ever told it — the frame stayed in
  // «Проявляем…» for as long as the person kept looking, which is exactly what they reported. Only
  // while something is actually being made, and only while this screen is the one in front:
  // «Добавить ещё» leaves the whole memory mounted behind it.
  const preparing = stillPreparing(items);
  const focused = useIsFocused();
  useEffect(() => {
    if (!preparing || !focused) return;
    // An interval and not a timeout chained off each read: a single read that comes back on a bad
    // connection would end the chain, and it would end it silently — the quiet read is quiet about
    // failing too. This one keeps its own time and is cleared the moment there is nothing left
    // being made, the screen goes behind another, or it unmounts.
    const timer = setInterval(() => read(true), WHILE_PREPARING_MS);
    return () => clearInterval(timer);
  }, [preparing, focused, read]);

  const wrote = useCallback((change: (have: MediaItem[] | null) => MediaItem[] | null) => {
    writes.current += 1;
    setItems(change);
  }, []);

  return { items, roster, labels, error, loading, read, readLabels, wrote };
}
