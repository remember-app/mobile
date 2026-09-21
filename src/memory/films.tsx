import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Download } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, Share, StyleSheet, View } from 'react-native';

import { ApiError, errorMessage, listMontages, retryMontage, type Memory, type Montage } from '@/api';
import { useAuth } from '@/auth';
import { formatDay, formatRuntime } from '@/dates';
import { maySaveToPhone, saveToPhone } from '@/downloads';
// From the gallery's own module: one rule about what a quiet re-read may replace, and this list is
// polled quietly for the same reason that one is. Its doc says why both lists read it.
import { keepReady } from '@/frames';
import {
  ActionBar,
  BadgeMontage,
  Banner,
  Button,
  CardMontage,
  CardMontageNew,
  EmptyMontages,
  Text,
  type MontageState,
} from '@/kit';
import { useStrings } from '@/language';
import { BlockHead } from '@/memory/head';
import { beingMade, WHILE_MAKING_MS } from '@/montage';
import { useTurnsWithPhone } from '@/orientation';
import { type Strings } from '@/strings';
import { space, themes, ThemePin } from '@/theme';

/** The four standings a montage can be in, in the three the kit draws (section 10). */
const MONTAGE_STATE: Record<Montage['status'], MontageState> = {
  queued: 'pending',
  processing: 'pending',
  ready: 'ready',
  failed: 'failed',
};

/**
 * Whether anything in the list is still owed by the worker — its reason to look again, and its
 * reason to stop. The one-row question behind it, and how long to wait before asking it, are
 * `@/montage`'s: the screen an order lands on waits over one montage and asks both the same way.
 */
const stillMaking = (montages: readonly Montage[] | null) =>
  montages?.some((montage) => beingMade(montage.status)) ?? false;

/**
 * What a montage is called on screen: how long it runs once it does, and the day it was asked for
 * until then — a length is the one thing about it that is worth a title, and there is none to say
 * until the worker has made it.
 */
const montageTitle = (montage: Montage, s: Strings) => {
  const runtime = formatRuntime(montage.duration_seconds);
  return runtime ? s.montage.ofLength(runtime) : s.montage.fromDay(formatDay(montage.created_at));
};

/**
 * What a finished montage was made of — «14 сентября · горизонтальный · Тёплая» (spec 7.6). The day
 * it was ordered on, and the wishes that shaped it; a montage cut before any of them could be asked
 * for simply says less, rather than saying a default somebody never chose. A track off the phone is
 * named as one: its key is a storage path and never a word for a person.
 */
function madeOf(montage: Montage, s: Strings): string {
  const parts = [formatDay(montage.created_at)];
  if (montage.params.orientation) parts.push(s.montage.orientation[montage.params.orientation]);
  if (montage.params.music_track_id) parts.push(s.montage.track[montage.params.music_track_id]);
  else if (montage.params.music_track_key) parts.push(s.montage.ownTrackShort);
  return parts.join(' · ');
}

/**
 * The «Ролики» block, first thing on a memory's feed (spec 8, `MemoryFrames`): the reward stands
 * over the material it is made of. Not a face of the memory any more — the tabs are gone — but a
 * strip that scrolls sideways at the head of the frames: the dashed «Новый ролик» tile, then what
 * has been made and what is being made.
 *
 * Behind no role at all: the video is what everybody who brought material gets back, so a viewer
 * reads the strip too. Only the organizer orders one, and only the organizer starts a fallen one
 * again — the api is the authority on that, and the level is read off the memory the route holds.
 *
 * A memory with no montages in it is `FilmsEmpty`: the dashed block that stands where the strip
 * would be, saying what a montage is and offering to cut one.
 */
export function Films({ id, memory }: { id: string; memory: Memory | null }) {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  // null means «not loaded yet» — the distinction the feed around it draws too, so a refetch after
  // an order keeps the cards on screen instead of flashing over them.
  const [montages, setMontages] = useState<Montage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * Which film this screen was asked to play on the way in — «В роликах» on the frame's own sheet
   * (spec 8, `SheetFrameInfo`), the one road here that names a montage. There is no second player
   * in the product: a frame's sheet points at this one, and one parameter is the whole of the ask
   * now that the memory has no faces left to name (TASK-207).
   */
  const { montage: asked } = useLocalSearchParams<{ montage?: string }>();
  /** The montage being watched, held by id so a reload hands it a fresh signed url. */
  const [playing, setPlaying] = useState<string | null>(asked ?? null);

  // Asked once and not for ever: the ask is seeded above as this block mounts, and the url is then
  // cleared so that coming back to the memory does not raise the player again.
  useEffect(() => {
    if (asked) router.setParams({ montage: '' });
  }, [asked, router]);

  /**
   * How many times this block has written the list itself — the retry that requeues a row. It is an
   * answer the api handed back, so it is newer than any read that was already in flight: a quiet one
   * resolving after it would put the list back the way the api had it a moment *before*, and the
   * retried card would go back to «Did not finish». Worse, that snapshot has nothing pending in it,
   * so the loop below clears itself and nothing reads again until the screen is left and come back
   * to. So a quiet read carries the count it started under and drops its answer if that has moved
   * (found in review, TASK-125).
   */
  const writes = useRef(0);

  const load = useCallback(
    // `quiet` is for the re-read below, which nobody asked for: it happens on its own every few
    // seconds, so it must not put a banner over a list that is fine on the one read that fails, nor
    // take the banner off one that is not.
    (quiet = false) => {
      if (!token) return;
      if (!quiet) setError(null);
      const startedAt = writes.current;
      // Only the montages: this is the call that answers 503 over a bucket nobody configured, and
      // it must not take the memory's own name down with it — that one is the route's.
      listMontages(token, id).then(
        (list) => {
          // Stale by the time it landed — see `writes`. A read somebody asked for is never stale.
          if (quiet && writes.current !== startedAt) return;
          // A quiet read is looking for what the worker has finished, and it must not disturb what
          // was already finished: `keepReady` holds every `ready` row's own object, so the signed
          // links behind the cards do not move. Without it this read handed `Playing` a freshly
          // signed `video_url` every five seconds, and `expo-video` builds a new player for a new
          // url — so the montage somebody was watching started over, every five seconds, for as
          // long as anything else was still being cut.
          setMontages((have) => (quiet ? keepReady(have, list) : list));
          // Including on a quiet read: once the list is in, the banner over it is about a read that
          // is no longer the last word, and nothing else would take it down until the next focus.
          setError(null);
        },
        (e: unknown) => {
          if (!quiet) setError(errorMessage(e));
        },
      );
    },
    [token, id],
  );

  // On focus rather than on mount, the way the home screen does it — and here it is the montages
  // that need it: a queued one only ever changes on the worker's side, and `video_url` is signed
  // for a quarter of an hour. Coming back from anywhere re-reads it, instead of leaving a card that
  // has been stale since whenever this screen was first opened.
  //
  // And the player is shut on the way out (TASK-94, extended in review): a `router.push` off a
  // tapped push leaves the whole memory mounted behind it, so a playing montage stood over the
  // screen that came next. Since TASK-124 it cost a second thing — `useTurnsWithPhone` below
  // follows the modal and not the mount, so nothing put the app back in portrait.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => setPlaying(null);
    }, [load]),
  );

  // And the same reason with nobody navigating anywhere: the montage somebody just ordered turns
  // `ready` while they sit here watching the card, and until this loop existed nothing told the
  // screen — the card said «Собираем» until it was left and come back to, which is what was
  // reported (TASK-125). Only while there is something being cut, and only while this screen is the
  // one in front: the player and the order screen leave the whole memory mounted behind them.
  const making = stillMaking(montages);
  const focused = useIsFocused();
  useEffect(() => {
    if (!making || !focused) return;
    // An interval and not a timeout chained off each read: one read failing on a bad connection
    // would end the chain, and end it silently — the quiet read says nothing about failing. This
    // one keeps its own time and is cleared the moment there is nothing left being cut, the screen
    // goes behind something, or it unmounts.
    const timer = setInterval(() => load(true), WHILE_MAKING_MS);
    return () => clearInterval(timer);
  }, [making, focused, load]);

  const role = memory?.role ?? null;
  const watching = montages?.find((montage) => montage.id === playing) ?? null;

  // A wide montage is worth turning the phone for — and since TASK-126 wide is what was asked for
  // at the order rather than what every montage is; `params.orientation` says which one this is.
  // The player is left free both ways all the same: a standing montage has no reason to be turned
  // and nothing breaks if it is, so there is nothing here worth deciding per montage. The
  // `supportedOrientations` on the modal below only says which ways up it may be drawn — this is
  // what lets the app leave portrait at all. Which is given back on the cleanup, so what has to be
  // true is that the player is shut on every way off this screen — the focus effect above does that.
  useTurnsWithPhone(watching !== null);

  /**
   * Every api call a button here makes is the same shape: lock the controls, run one call, say one
   * line about it. `said` maps the statuses this particular call can come back with; anything else
   * falls through to the api's own wording. Saving a montage onto the phone is the one button that
   * stays outside this: nothing it can fail at is the api's doing, so `keep` says its own words and
   * carries its own «Saving…» line while it works.
   */
  async function act(
    what: (session: string) => Promise<string | null>,
    said: Partial<Record<number, string>> = {},
  ) {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      setNotice(await what(token));
    } catch (e) {
      setNotice((e instanceof ApiError ? said[e.status] : undefined) ?? errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /**
   * «Новый ролик» — the order as it stands today: the four steps of `memory/[id]/order`. The
   * templates the layout draws in front of them are the montage milestone's, and this tile is where
   * they will land; nothing is ordered here either way, and the strip meets what that screen ordered
   * through the read on focus.
   */
  const askForOne = () => router.push({ pathname: '/memory/[id]/order', params: { id } });

  /**
   * Where a montage still being made is watched — `MontageProgress` (spec 8, TASK-163), the screen
   * that says in stages how far along it is. `MontageLive`, the montage as a spectacle, replaces it
   * in its own milestone; the card leads to whichever of the two is standing there.
   *
   * A push and not a replace: this screen is what that one goes back to, and its own way out is a
   * `back()`. Nothing about the frames goes over — the count the wizard carries is what it counted
   * while picking, and nobody counts it back off a finished order.
   */
  const watchMaking = (montage: Montage) =>
    router.push({
      pathname: '/memory/[id]/montage/[montageId]',
      params: { id, montageId: montage.id },
    });

  /** The organizer's button under one that fell over: the same row queued again, never a second. */
  const retry = (montage: Montage) =>
    act(
      async (session) => {
        try {
          const requeued = await retryMontage(session, id, montage.id);
          writes.current += 1;
          setMontages(
            (have) => have?.map((one) => (one.id === montage.id ? requeued : one)) ?? null,
          );
          return null;
        } catch (e) {
          // 409 is «this row is not failed any more»: it was started again from somewhere else, or
          // the worker reached it while this card sat here. The card is the thing that is out of
          // date, so the list is read again — left alone it would go on saying «Did not finish»
          // under a line saying the opposite, with a button that can only ever 409 now.
          if (e instanceof ApiError && e.status === 409) load();
          throw e;
        }
      },
      {
        // Which of the three it moved to is on its way in from the line above; the api's own body
        // carries it too, and neither is worth a second sentence for a button pressed this rarely.
        409: s.montage.movedOn,
        403: s.montage.retryDenied,
      },
    );

  /**
   * The finished video kept and then handed on — doc-03 asks for both, and this is one press
   * because the local copy the share sheet needs exists only between the two. The sheet is opened
   * on that copy and not on `video_url`: the link is signed and dies in a quarter of an hour, so
   * whoever it was sent to would get a refusal instead of a video.
   *
   * It lives in the player and not on the card: the card in the strip is 232 × 148 of poster with
   * the name over it, and there is no room on it for a button — the place a montage is saved from
   * is the place it is watched from.
   *
   * ponytail: React Native's own `Share` attaches a file on iOS only — on Android the sheet goes
   * out with the line and without the video, which is by then in the phone's gallery and shareable
   * from there. `expo-sharing` is the upgrade when that is not good enough.
   */
  async function keep(montage: Montage) {
    if (montage.video_url === null) return;
    setBusy(true);
    // The whole of the progress there is: a save is atomic, the same way the gallery's is.
    setNotice(s.save.montage);
    try {
      if (!(await maySaveToPhone())) {
        setNotice(s.error.galleryRefused);
        return;
      }
      await saveToPhone({ id: montage.id, kind: 'video', url: montage.video_url }, async (uri) => {
        // Dismissing the sheet is not a failure, and neither is a phone with nowhere to send it.
        await Share.share({
          url: uri,
          // The memory's own title is what a person wrote; it goes out as it stands.
          message: memory ? s.montage.shareText(memory.title) : montageTitle(montage, s),
        }).catch(() => {});
      });
      setNotice(s.save.done);
    } catch {
      // Nothing here is the api's doing: the link came with the list, and past that it is the
      // download or the phone's own gallery.
      setNotice(s.save.failedMontage);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.block}>
      {/* The heading and its counter (spec 8): how many films this memory has, and «пока нет» while
          it has none. Nothing counted until the list answers — a zero over a list in flight is a
          number nobody can trust. */}
      <BlockHead
        title={s.montage.title}
        count={
          montages === null
            ? undefined
            : montages.length === 0
              ? s.montage.noneYet
              : String(montages.length)
        }
      />

      {error !== null ? (
        <Banner tone="error" text={error} style={styles.aside}>
          {/* Called and not handed over: `load` takes «read quietly» as its argument, and a press
              handler is given the touch event — so handing it over asks for a quiet read from the
              one press that has to speak up about what it finds. */}
          <Button size="xs" variant="quiet" label={s.action.retry} onPress={() => load()} />
        </Banner>
      ) : montages === null ? null : montages.length === 0 ? (
        // `FilmsEmpty` (spec 8): the dashed block that stands where the strip would be, not an empty
        // state — the two leaning frames are the reward itself, and the words say what a montage is,
        // because this is where a person first meets the idea. The paper button is the organizer's:
        // doc-03 makes ordering theirs alone, and offering it to anybody else is a door into a 403.
        <EmptyMontages
          style={styles.aside}
          photos={memory?.recent_thumbnail_urls}
          text={s.montage.emptyNote}
        >
          {role === 'organizer' ? (
            <Button variant="paper" size="sm" label={s.montage.makeIt} onPress={askForOne} />
          ) : null}
        </EmptyMontages>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {/* Spec 7.6 — the dashed tile stands first in the strip, always: it is the one place on
              the memory's own screen where a new film is started. */}
          {role === 'organizer' ? (
            <CardMontageNew label={s.montage.newOne} onPress={askForOne} />
          ) : null}

          {montages.map((montage) => {
            const state = MONTAGE_STATE[montage.status];

            return (
              <CardMontage
                key={montage.id}
                state={state}
                title={montageTitle(montage, s)}
                // Spec 7.6 gives the three states three different bodies: a finished one says what
                // it was made of, and the two that have nothing to show yet say where they stand
                // instead — «Мы сообщим, когда будет готов», «Сборка оборвалась на полпути».
                meta={state === 'ready' ? madeOf(montage, s) : undefined}
                caption={
                  state === 'ready'
                    ? undefined
                    : state === 'failed'
                      ? s.montage.broke
                      : s.montage.caption
                }
                poster={montage.poster_url ?? undefined}
                badge={<BadgeMontage state={state} label={s.montage.status[montage.status]} />}
                // Watching a finished one, or walking into the making of one that is still owed.
                // Either way it is the whole card, which is what the layout gives it.
                onPress={
                  beingMade(montage.status)
                    ? () => watchMaking(montage)
                    : montage.video_url === null
                      ? undefined
                      : () => setPlaying(montage.id)
                }
              >
                {/* The one button a card carries, and only the fallen card has room for it: a
                    finished one is saved from the player it is watched in. */}
                {state === 'failed' && role === 'organizer' ? (
                  <Button
                    size="sm"
                    label={s.action.retry}
                    onPress={() => void retry(montage)}
                    disabled={busy}
                  />
                ) : null}
              </CardMontage>
            );
          })}
        </ScrollView>
      )}

      {/* What a press here answered with. Only while the player is down: with it up, the copy
          inside the window is the one that can be read. */}
      {notice && watching === null ? <Banner text={notice} style={styles.aside} /> : null}

      {/* The finished video played where it lies: `expo-video` streams it from the signed link
          rather than downloading it first. A modal and not a screen — there is nothing to do in here
          but watch it, keep it and close it. */}
      <Modal
        visible={watching !== null}
        animationType="fade"
        onRequestClose={() => setPlaying(null)}
        // Landscape too: a montage ordered wide is worth turning the phone for, and the rest of
        // the app is portrait-only.
        supportedOrientations={['portrait', 'landscape']}
      >
        {watching === null || watching.video_url === null ? null : (
          <View style={styles.viewer}>
            {/* The pin, and not only the `room.ink` under it: the bar is the kit's own and draws
                its `ink` and its hairline, which in daylight is a pale strip across the bottom of
                the dark room. Everything inside the player takes the dark set. */}
            <ThemePin value="dark">
              <Playing url={watching.video_url} />
              {notice ? <Banner text={notice} style={styles.aside} /> : null}
              {/* Spec 7.2 gives «Закрыть» the outlined button, which is what it wears on
                  `SheetFrame` and on the consent too (TASK-177, off a device: a quiet one stood as
                  a line of text in the left corner and read as nothing the app draws). Beside it
                  the one thing to be done with a finished montage, in the glowing weight. */}
              <ActionBar>
                <Button label={s.action.close} onPress={() => setPlaying(null)} />
                <Button
                  variant="primary"
                  wide
                  icon={Download}
                  label={s.montage.saveShare}
                  disabled={busy}
                  onPress={() => void keep(watching)}
                />
              </ActionBar>
            </ThemePin>
          </View>
        )}
      </Modal>
    </View>
  );
}

/**
 * The montage, played from its signed link. Its own component because the player is a hook, and
 * this one is mounted only while the video is on screen — leaving it releases the player.
 *
 * The open frame has these same three lines for its previews, down to the style. Not shared, and
 * not because the two differ: it is one `useVideoPlayer` call, and a module of its own around it
 * would be the bigger thing. Worth making the moment a third screen plays a video, or the moment
 * these two disagree.
 */
function Playing({ url }: { url: string }) {
  const player = useVideoPlayer(url, (video) => video.play());
  return <VideoView player={player} style={styles.big} />;
}

/**
 * The player is held in the dark set in every theme — spec 8 gives it a background darker than
 * `ink` (`photo.viewer`) so the video is the only light thing on the screen. `frame-viewer.tsx`
 * says the same at more length; the two draw the same kind of room, and this is the one value in
 * this sheet that has an opinion.
 *
 * So nothing here turns with the theme, and the sheet is a plain one: everything else this file
 * draws is a kit component on the screen's own background, and those turn by themselves.
 */
const room = themes.dark.color;

const styles = StyleSheet.create({
  // Spec 8: the heading, then 10 down to the strip that stands under it.
  block: { gap: 10 },
  // The strip runs edge to edge and starts at the screen's own 16, so the last card slides off the
  // right edge rather than stopping inside a margin.
  strip: { flexDirection: 'row', gap: space.s2, paddingHorizontal: space.s4 },
  // Everything that is not the strip keeps the screen's margins instead: the dashed block, the line
  // about a read that failed, the line a press answered with.
  aside: { marginHorizontal: space.s4 },
  viewer: { flex: 1, backgroundColor: room.ink, justifyContent: 'center' },
  big: { flex: 1, width: '100%' },
});
