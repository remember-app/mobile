import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Download, Film, Play } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  errorMessage,
  listMontages,
  retryMontage,
  type Montage,
} from '@/api';
import { useAuth } from '@/auth';
import { formatDay, formatRuntime } from '@/dates';
import { maySaveToPhone, saveToPhone } from '@/downloads';
// From the gallery's own module: one rule about what a quiet re-read may replace, and this list is
// polled quietly for the same reason that one is. Its doc says why both faces read it.
import { keepReady } from '@/frames';
import {
  ActionBar,
  BadgeMontage,
  Banner,
  Button,
  CardMontage,
  Empty,
  Text,
  type MontageState,
} from '@/kit';
import { useStrings } from '@/language';
import { MemoryHead, type Head } from '@/memory/head';
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
 * How long the face waits before reading again while a montage is being cut. Longer than the frames
 * face waits on a thumbnail, because this is minutes of work and not seconds of it — five is still
 * inside the moment somebody spends looking at the card wondering whether it moved.
 */
const WHILE_MAKING_MS = 5000;

/**
 * Whether anything in the list is still owed by the worker. A `queued` or `processing` row only
 * changes on the worker's side, so a face holding one has news coming that nothing will tell it —
 * this is its reason to look again, and its reason to stop.
 */
const stillMaking = (montages: readonly Montage[] | null) =>
  montages?.some((montage) => montage.status === 'queued' || montage.status === 'processing') ??
  false;

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
 * The second face of a memory (kit, «Экраны» 5): what has been made, what is being made, and — for
 * the organizer — the asking for one more. Its own face and not a block over the roster: «ролики не
 * смешиваются с галереей» (doc-03), and neither do they with the guest list.
 *
 * Behind no role at all: the video is what everybody who brought material gets back, so a viewer
 * reads the list too. Only the organizer orders one, and only the organizer starts a fallen one
 * again — the api is the authority on that, and the level is read off the memory the screen holds.
 *
 * Nothing on the right of the appbar here: the kit gives that corner to the frames alone, and the
 * road to the other two faces is the switch under the name.
 */
export function Films({ id, head }: { id: string; head: Head }) {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const insets = useSafeAreaInsets();
  // null means «not loaded yet» — the same distinction the other faces draw, so a refetch after
  // an order keeps the cards on screen instead of flashing the spinner over them.
  const [montages, setMontages] = useState<Montage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** The montage being watched, held by id so a reload hands it a fresh signed url. */
  const [playing, setPlaying] = useState<string | null>(null);

  // The memory itself — the title over this face and the level that decides whether it has a footer
  // — is read once by the screen and handed to all three faces, so switching between them does not
  // blink the name in the appbar.
  const memory = head.memory;

  /**
   * How many times this face has written the list itself — the retry that requeues a row, and until
   * TASK-162 the order that put a new one on top. It is an answer the api handed back, so it is
   * newer than any read that was already in flight: a quiet one resolving after it would put the
   * list back the way the api had it a moment *before*, and the retried card would go back to «Did
   * not finish». Worse, that snapshot has nothing pending in it, so the loop
   * below clears itself and this face — which has no pull-to-refresh — never reads again until the
   * tabs are switched. So a quiet read carries the count it started under and drops its answer if
   * that has moved (found in review, TASK-125).
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
      // it must not take the memory's own name down with it — that one is the screen's, above.
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
  // has been stale since whenever this face was first opened.
  //
  // And the viewer is shut on the way out (TASK-94, extended here in review): a `router.push` off a
  // tapped push leaves the whole memory mounted behind it, so a playing montage stood over the
  // screen that came next. Since TASK-124 it cost a second thing — `useTurnsWithPhone` below
  // follows the modal and not the mount, so nothing put the app back in portrait.
  //
  // The viewer is the only window left here: the order used to be a sheet over this face and is a
  // screen of its own since TASK-162, and this read on focus is also how the list meets what that
  // screen ordered.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => setPlaying(null);
    }, [load]),
  );

  // And the same reason with nobody navigating anywhere: the montage somebody just ordered turns
  // `ready` while they sit here watching the card, and until this loop existed nothing told the
  // face — the card said «Собираем» until the tabs were switched away and back, which is what was
  // reported (TASK-125). Only while there is something being cut, and only while this face is the
  // one in front: the viewer and the order screen leave the whole memory mounted behind them.
  const making = stillMaking(montages);
  const focused = useIsFocused();
  useEffect(() => {
    if (!making || !focused) return;
    // An interval and not a timeout chained off each read: one read failing on a bad connection
    // would end the chain, and end it silently — the quiet read says nothing about failing. This
    // one keeps its own time and is cleared the moment there is nothing left being cut, the face
    // goes behind something, or it unmounts.
    const timer = setInterval(() => load(true), WHILE_MAKING_MS);
    return () => clearInterval(timer);
  }, [making, focused, load]);

  const role = memory?.role ?? null;
  const watching = montages?.find((montage) => montage.id === playing) ?? null;

  // A wide montage is worth turning the phone for — and since TASK-126 wide is what was asked for
  // at the order rather than what every montage is; `params.orientation` says which one this is.
  // The viewer is left free both ways all the same: a standing montage has no reason to be turned
  // and nothing breaks if it is, so there is nothing here worth deciding per montage. The
  // `supportedOrientations` on the modal below only says which ways up it may be drawn — this is
  // what lets the app leave portrait at all. Which is given back on the cleanup, so what has to be
  // true is that the viewer is shut on every way out of this face — the focus effect above is where
  // that is done.
  useTurnsWithPhone(watching !== null);

  /**
   * Every api call this face's buttons make is the same shape: lock the controls, run one call,
   * say one line about it. `said` maps the statuses this particular call can come back with;
   * anything else falls through to the api's own wording. Saving a montage onto the phone is the
   * one button that stays outside this: nothing it can fail at is the api's doing, so `keep` says
   * its own words and carries its own «Saving…» line while it works.
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
   * «Смонтируй ролик» — the four steps of spec 8, on a screen of its own (`memory/[id]/order`).
   * Nothing is ordered here any more: the order is the last button of that wizard, and this face
   * reads the list again on focus, so what it comes back to already holds the new card.
   */
  const askForOne = () => router.push({ pathname: '/memory/[id]/order', params: { id } });

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
    <>
      <MemoryHead {...head} />

      <ScrollView contentContainerStyle={styles.body}>
        {error !== null ? (
          <Banner tone="error" text={error}>
            {/* Called and not handed over: `load` now takes «read quietly» as its argument, and a
                press handler is given the touch event as its argument — so handing it over asks for
                a quiet read from the one press that has to speak up about what it finds. */}
            <Button size="xs" variant="quiet" label={s.action.retry} onPress={() => load()} />
          </Banner>
        ) : null}

        {/* Beside the list and not in place of it: `load` runs on every focus, so a list that was
            read once outlives a refetch that failed. Wiping it would take the videos off the
            screen over a blip. */}
        {montages === null ? (
          error === null ? (
            <View style={styles.middle}>
              <Empty busy text={s.state.loading} />
            </View>
          ) : null
        ) : montages.length === 0 ? (
          // `FilmsEmpty`, and it is not a report of what is missing: the sign is the reward itself —
          // two of the memory's own frames with the play circle over them — and the words explain
          // what a montage is, because the button that starts one is on the bar below. Which
          // invitation depends on who is reading, and nothing is said until the memory has answered:
          // `role` comes off it, and an organizer shown «the organizer can ask for one» is being
          // told about themselves.
          role === null ? null : (
            <View style={styles.middle}>
              <Empty
                sign="poster"
                icon={Play}
                photos={memory?.recent_thumbnail_urls}
                title={s.montage.emptyTitle}
                text={role === 'organizer' ? s.montage.emptyOrganizer : s.montage.empty}
              />
            </View>
          )
        ) : (
          montages.map((montage) => {
            const state = MONTAGE_STATE[montage.status];

            return (
              <View key={montage.id} style={styles.montage}>
                <CardMontage
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
                  // The running time in the poster's corner — the same number the title carries,
                  // which is the whole of what the layout writes over a still.
                  length={formatRuntime(montage.duration_seconds)}
                  // The orientation is known from the moment the montage was ordered, so the frame
                  // is the right shape before there is a poster in it — and a vertical still is
                  // shown whole rather than through a horizontal crop.
                  vertical={montage.params.orientation === 'portrait'}
                  badge={<BadgeMontage state={state} label={s.montage.status[montage.status]} />}
                  playLabel={s.montage.watch(montageTitle(montage, s))}
                  onPlay={montage.video_url === null ? undefined : () => setPlaying(montage.id)}
                >
                  {/* The one button a card carries, beside its badge: the outlined 44 of spec 7.6,
                      «Сохранить и поделиться» under a finished montage and «Повторить» under one
                      that fell over. Words and not a glyph — the layout writes both out. */}
                  {state === 'ready' ? (
                    <Button
                      size="sm"
                      icon={Download}
                      label={s.montage.saveShare}
                      disabled={busy || montage.video_url === null}
                      onPress={() => void keep(montage)}
                    />
                  ) : state === 'failed' && role === 'organizer' ? (
                    <Button
                      size="sm"
                      label={s.action.retry}
                      onPress={() => void retry(montage)}
                      disabled={busy}
                    />
                  ) : null}
                </CardMontage>
                {/* The kit's own rule is that a failure is not explained by a code — so the word
                    beside the dot stays the screen's, and the worker's own line goes under the
                    card, where there is room for it and where it is not the first thing read. */}
                {montage.status === 'failed' && montage.error_text !== null ? (
                  <Text role="meta">{montage.error_text}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Above the bar and outside the scroll, the way the frames face holds its own: what the
          button below answers with must not land at the bottom of a list that has scrolled away. The
          bar is also what carries the phone's own bottom inset — and there is no bar for anybody but
          the organizer, so without this the line lands under the home indicator for everybody who
          only ever saves a movie. */}
      {notice ? (
        <Banner
          text={notice}
          style={
            role === 'organizer'
              ? styles.notice
              : [styles.notice, { marginBottom: Math.max(insets.bottom, space.s4) }]
          }
        />
      ) : null}

      {/* The face's one glowing button for the organizer — doc-03 makes ordering theirs alone, and
          it is the thing the whole memory is being filled up for. In the bottom bar because that is
          where this app keeps the one action of a screen.
          Not before the list has answered: standing outside the scroll, this bar is gated on the
          role, which comes off the memory and lands first — so it would offer the way into an order
          over a list still in flight, or a second failure under one that failed to read. */}
      {role === 'organizer' && montages !== null ? (
        <ActionBar>
          <Button
            variant="primary"
            wide
            icon={Film}
            label={s.montage.make}
            onPress={askForOne}
            disabled={busy}
          />
        </ActionBar>
      ) : null}

      {/* The finished video played where it lies, the way the frames face plays a preview:
          `expo-video` streams it from the signed link rather than downloading it first. A modal and
          not a screen — there is nothing to do in here but watch it and close it. */}
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
            {/* The pin, and not only the `room.ink` under it: the bar is the kit's `.actionbar`
                and draws its own `ink` and its own hairline, which in daylight is a pale strip
                across the bottom of the dark room. Everything inside the viewer takes the dark
                set, the same way `.viewer`'s children inherit it in the kit. */}
            <ThemePin value="dark">
              <Playing url={watching.video_url} />
              <ActionBar style={styles.bar}>
                <Button variant="quiet" label={s.action.close} onPress={() => setPlaying(null)} />
              </ActionBar>
            </ThemePin>
          </View>
        )}
      </Modal>
    </>
  );
}

/**
 * The montage, played from its signed link. Its own component because the player is a hook, and
 * this one is mounted only while the video is on screen — leaving it releases the player.
 *
 * The frames face has these same three lines for its previews, down to the style. Not shared, and
 * not because the two differ: it is one `useVideoPlayer` call, and a module of its own around it
 * would be the bigger thing. Worth making the moment a third face plays a video, or the moment
 * these two disagree.
 */
function Playing({ url }: { url: string }) {
  const player = useVideoPlayer(url, (video) => video.play());
  return <VideoView player={player} style={styles.big} />;
}

/**
 * The viewer is held in the dark set in every theme — spec 8 gives it a background darker than
 * `ink` (`photo.viewer`) so the photograph is the only light thing on the screen. `frames.tsx` says
 * the same at more length; the two faces draw the same viewer, and this is the one value in this
 * sheet that has an opinion.
 *
 * So nothing here turns with the theme, and the sheet is a plain one: the list this face draws is
 * cards from the library on the screen's own background, and both already turn by themselves.
 */
const room = themes.dark.color;

const styles = StyleSheet.create({
  // The kit's 16 at the sides, which the head above and the bar below keep as well — the bar draws
  // its own, so nothing wraps it in a second copy of this.
  body: { flexGrow: 1, paddingHorizontal: space.s4, paddingBottom: space.s6, gap: space.s3 },
  // An empty state and a spinner both stand in the middle of the body rather than at the top of it
  // (spec 7.8): the list's place is held, not blinked over.
  middle: { flex: 1, justifyContent: 'center' },
  notice: { marginHorizontal: space.s4 },
  // A card and, under a fallen one, the line the worker left — closer to each other than the
  // face's own gap, because they are one thing.
  montage: { gap: space.s2 },
  viewer: { flex: 1, backgroundColor: room.ink, justifyContent: 'center' },
  bar: { justifyContent: 'center', paddingHorizontal: space.s4 },
  big: { flex: 1, width: '100%' },
});
