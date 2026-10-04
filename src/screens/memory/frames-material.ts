import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type Label, listLabels, listMedia, listMembers, type MediaItem, type Member } from '@/api';
import { answered, type Failure, failure } from '@/lib/failure';
import { keepReady, stillPreparing } from '@/lib/frames';
import { keepKept, readKept } from '@/lib/frames-kept';
import { duration } from '@/theme';

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

/**
 * Where the connection stands, as the screens draw it (spec 7.6, detail 47; `HomeOffline`,
 * `HomeOnline`) — four states and not two, because putting the message away is not the connection
 * coming back, and somebody who hid the line is still owed the news that it is.
 */
export type Link = 'ok' | 'back' | 'gone' | 'hushed';

/**
 * How a read may touch what is already on screen. Three and not one, because a read that somebody
 * asked for, a read the screen makes underneath itself, and the poll while the worker finishes
 * something are three different promises to the person looking at it.
 *
 * `asked` — the pull and «Повторить». The spinner and the banner are theirs, and the answer takes
 * every record's own links.
 * `under` — the read the screen makes on top of a feed it has already drawn: it lights nothing and
 * reports nothing over frames that are on screen, and it takes every link the api signed afresh —
 * what is on screen may have come off this phone, where those links have expired.
 * `under still` — the same, plus the finished records keep the objects they had, so the poll cannot
 * move a link behind a photograph that is already there (`keepReady`).
 */
export type Reading = 'asked' | 'under' | 'under still';

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
  error: Failure | null;
  loading: boolean;
  /**
   * Where the connection stands, as the asked reads found it — and nothing else moves it. A read the
   * screen makes underneath itself is quiet about this as it is about everything else: lighting the
   * plate over frames that are on screen is the one thing a quiet read must never do, or the three
   * seconds of a poll would stand a banner over somebody's photographs every time a frame turns
   * `ready`.
   */
  link: Link;
  /** The cross on the plate: the message goes, the news that it came back stays owed. */
  hushed: () => void;
  /** Read it again — asked, for a pull; under, for anything the screen does to itself. */
  read: (how?: Reading) => void;
  readLabels: () => void;
  /** The feed written by this screen itself: a frame deleted, a box filed. */
  wrote: (change: (have: MediaItem[] | null) => MediaItem[] | null) => void;
} {
  /**
   * What this phone kept of this memory, read once as the screen mounts rather than in an answer
   * that may never come (TASK-512, doc-12: the screen draws what is on the device first and asks
   * underneath). Off for «Мои кадры», which is a different list — it carries the frames their owner
   * hid, and none of those are on the phone to open from.
   *
   * `useState`'s own initialiser rather than an effect on purpose: the cached frames have to be on
   * screen on the first render, and an effect gets there one draw later, which is the blank this
   * whole card exists to take away.
   */
  const [kept] = useState(() => (hidden ? null : readKept(memoryId)));

  /**
   * Whether anything at all is on screen — the cache's answer or the api's — and what the read on
   * focus is: asked for over an empty screen, run underneath one that is not empty.
   */
  const drew = useRef(kept !== null);

  // null means «not loaded yet», the distinction the montage block draws too: a reload after a
  // delete keeps the feed on screen instead of flashing the spinner over it.
  const [items, setItems] = useState<MediaItem[] | null>(kept?.items ?? null);
  const [roster, setRoster] = useState<Member[] | null>(kept?.roster ?? null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [error, setError] = useState<Failure | null>(null);
  // Nothing to wait for over a feed this phone already had: the pull reads underneath it.
  const [loading, setLoading] = useState(kept === null);
  const [link, setLink] = useState<Link>('ok');

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
    (how: Reading = 'asked') => {
      if (!token) return;
      const quiet = how !== 'asked';
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
            if (how === 'under still' && writes.current !== startedAt) return;
            // The poll is looking for what the worker has finished, and it must not disturb what was
            // already finished: `keepReady` holds every `ready` record's own object, so the urls
            // behind the frames on screen do not move and nothing is fetched twice. A catch-up read
            // is not that one — the links it drew from came off this phone and have expired — so it
            // takes every link the api signed afresh.
            setItems((have) => (how === 'under still' ? keepReady(have, media) : media));
            setRoster(members);
            setError(null);
            drew.current = true;
            // An answer of any kind is the connection being there — including one that refused,
            // which is the api's own word rather than a silence. The good news is owed only to
            // somebody who watched it go, and it is not owed twice: a read landing while the plate
            // that says it is back is still standing leaves that same object in place, so the three
            // seconds it has left do not start over.
            if (!quiet) setLink((was) => (was === 'gone' || was === 'hushed' ? 'back' : was));
            // What came back is what the next launch opens on. A read that failed writes nothing,
            // so a phone that cannot reach the api keeps what it had rather than emptying it.
            if (!hidden) keepKept(memoryId, media, members);
          },
          (e: unknown) => {
            if (quiet) return;
            setError(failure(e));
            // Only a read nobody got an answer at all is the connection (TASK-275: everything the api
            // refused came back in its own words, and that is about something else). A refused pull
            // says itself in the banner and leaves the plate alone — otherwise every 403 over a
            // feed that is fine would put «нет связи» over somebody's photographs.
            if (!answered(e)) setLink('gone');
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
  //
  // `under` where this phone already had the feed: the read runs underneath frames that are on
  // screen, lights nothing over them, and a failure over them is the absence of an answer rather
  // than a refusal to draw. `asked` where it had nothing — there is a spinner and a banner, and
  // both are the truth about a screen with nothing to show yet.
  useFocusEffect(
    useCallback(() => {
      // Off `items` itself and not as a dependency: what decides this is whether the screen opened
      // on something, and that is settled by the time the first effect runs. Reading it off the
      // state would re-enter this effect on every answer and ask again on the back of each one.
      read(drew.current ? 'under' : 'asked');
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
    const timer = setInterval(() => read('under still'), WHILE_PREPARING_MS);
    return () => clearInterval(timer);
  }, [preparing, focused, read]);

  const wrote = useCallback((change: (have: MediaItem[] | null) => MediaItem[] | null) => {
    writes.current += 1;
    setItems(change);
  }, []);

  const hushed = useCallback(() => setLink((was) => (was === 'gone' ? 'hushed' : was)), []);

  // Spec 7.6: the `done` banner carries no button at all, because it is already going. This is it
  // going — the one thing on the screen that happens without anybody doing anything. It leaves on a
  // timer of its own and not on a read: the news was already given the moment an answer arrived, and
  // a screen nobody touches any more must finish saying it by itself.
  useEffect(() => {
    if (link !== 'back') return;
    const leaves = setTimeout(() => setLink('ok'), duration.hold);
    return () => clearTimeout(leaves);
  }, [link]);

  return { items, roster, labels, error, loading, link, hushed, read, readLabels, wrote };
}
