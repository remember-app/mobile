import { useFocusEffect, useIsFocused } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Download, Film } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  errorMessage,
  listMontages,
  orderMontage,
  retryMontage,
  type Montage,
  type MontageOrientation,
  type MusicTrackId,
} from '@/api';
import { useAuth } from '@/auth';
import { formatDay, formatRuntime } from '@/dates';
import { maySaveToPhone, saveToPhone } from '@/downloads';
import {
  ActionBar,
  Banner,
  Button,
  CardMontage,
  Empty,
  IconButton,
  Sheet,
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
 * How long to ask for. The api takes anything from a quarter of a minute to five and fills in a
 * minute itself when nothing is asked — these are three round answers, not the whole range. The
 * seconds are the whole of it here; what each one is called is `montage.length` in the dictionary.
 */
const LENGTHS = [30, 60, 120] as const;

type Length = (typeof LENGTHS)[number];

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
  const s = useStrings();
  const insets = useSafeAreaInsets();
  // null means «not loaded yet» — the same distinction the other faces draw, so a refetch after
  // an order keeps the cards on screen instead of flashing the spinner over them.
  const [montages, setMontages] = useState<Montage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  // What the order will ask for. The api's own default length, and a track chosen rather than left
  // to the worker — it is one tap either way, and a person who opened the sheet came to choose.
  const [seconds, setSeconds] = useState<Length>(60);
  const [track, setTrack] = useState<MusicTrackId>('warm');
  // Horizontal, which is what every montage was before this could be asked — the api reads a missing
  // orientation as exactly this one, so an untouched sheet orders what it always ordered.
  const [orientation, setOrientation] = useState<MontageOrientation>('landscape');
  /** The montage being watched, held by id so a reload hands it a fresh signed url. */
  const [playing, setPlaying] = useState<string | null>(null);

  // The memory itself — the title over this face and the level that decides whether it has a footer
  // — is read once by the screen and handed to all three faces, so switching between them does not
  // blink the name in the appbar.
  const memory = head.memory;

  const load = useCallback(
    // `quiet` is for the re-read below, which nobody asked for: it happens on its own every few
    // seconds, so it must not put a banner over a list that is fine on the one read that fails, nor
    // take the banner off one that is not.
    (quiet = false) => {
      if (!token) return;
      if (!quiet) setError(null);
      // Only the montages: this is the call that answers 503 over a bucket nobody configured, and
      // it must not take the memory's own name down with it — that one is the screen's, above.
      listMontages(token, id).then(
        (list) => {
          setMontages(list);
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
  useFocusEffect(load);

  // And the same reason with nobody navigating anywhere: the montage somebody just ordered turns
  // `ready` while they sit here watching the card, and until this loop existed nothing told the
  // face — the card said «Собираем» until the tabs were switched away and back, which is what was
  // reported (TASK-125). Only while there is something being cut, and only while this face is the
  // one in front: the viewer and the order sheet leave the whole memory mounted behind them.
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

  // A montage is 16:9 and worth turning the phone for. The `supportedOrientations` on the modal
  // below only says which ways up it may be drawn — this is what lets the app leave portrait at all.
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
   * «Смонтируй ролик», with the three wishes doc-03 allows. The api answers with the row it wrote,
   * so it goes straight onto the top of the list — the list is newest first, and a reload would be
   * the same thing one round trip later.
   */
  const order = () =>
    act(
      async (session) => {
        const ordered = await orderMontage(session, id, {
          target_seconds: seconds,
          music_track_id: track,
          orientation,
        });
        setMontages((have) => [ordered, ...(have ?? [])]);
        setOrdering(false);
        return s.montage.ordered;
      },
      {
        // The api's own line names its numbers; this one names what to do about them.
        409: s.montage.tooLittle,
        403: s.montage.orderDenied,
      },
    );

  /** The organizer's button under one that fell over: the same row queued again, never a second. */
  const retry = (montage: Montage) =>
    act(
      async (session) => {
        try {
          const requeued = await retryMontage(session, id, montage.id);
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
            <Button sm variant="quiet" label={s.action.retry} onPress={() => load()} />
          </Banner>
        ) : null}

        {/* Beside the list and not in place of it: `load` runs on every focus, so a list that was
            read once outlives a refetch that failed. Wiping it would take the videos off the
            screen over a blip. */}
        {montages === null ? (
          error === null ? (
            <Empty busy text={s.state.loading} />
          ) : null
        ) : (
          <>
            {montages.map((montage) => (
              <View key={montage.id} style={styles.montage}>
                <CardMontage
                  state={MONTAGE_STATE[montage.status]}
                  title={montageTitle(montage, s)}
                  poster={montage.poster_url ?? undefined}
                  status={s.montage.status[montage.status]}
                  // Said in place of a bar or a number: nothing on this side knows how far along
                  // the worker is, and the push is what actually brings people back to look.
                  caption={s.montage.caption}
                  playLabel={s.montage.watch(montageTitle(montage, s))}
                  onPlay={montage.video_url === null ? undefined : () => setPlaying(montage.id)}
                  actions={
                    montage.status === 'ready' ? (
                      // The kit's own «Скачать ролик» in this footer is an `.iconbtn`, and it has
                      // to be: the title beside it is `flex:1` off a zero basis, so a button
                      // carrying «Сохранить и поделиться» squeezed the Russian title down to «Ро…».
                      // The words stay as the spoken label.
                      <IconButton
                        icon={Download}
                        label={s.montage.saveShare}
                        disabled={busy || montage.video_url === null}
                        onPress={() => void keep(montage)}
                      />
                    ) : montage.status === 'failed' && role === 'organizer' ? (
                      <Button
                        sm
                        label={s.action.retry}
                        onPress={() => void retry(montage)}
                        disabled={busy}
                      />
                    ) : null
                  }
                />
                {/* The kit's own rule is that a failure is not explained by a code — so the word
                    beside the dot stays the screen's, and the worker's own line goes under the
                    card, where there is room for it and where it is not the first thing read. */}
                {montage.status === 'failed' && montage.error_text !== null ? (
                  <Text role="meta">{montage.error_text}</Text>
                ) : null}
              </View>
            ))}

            {/* Nothing here is a report of what is missing: the kit's empty is an invitation
                (section 6), so the words say what a montage is and what it takes, and the button
                that starts one is on the bar below. Which invitation depends on who is reading —
                and nothing until the memory has answered, because `role` comes off it and the two
                reads race: an organizer shown «the organizer can ask for one» is being told about
                themselves. The cards above need no role and go up as soon as they arrive. */}
            {montages.length === 0 && role !== null ? (
              <Empty
                icon={Film}
                text={role === 'organizer' ? s.montage.emptyOrganizer : s.montage.empty}
              />
            ) : null}
          </>
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
          role, which comes off the memory and lands first — so it would offer an order over a list
          still in flight, and `order` prepends its new row to state that the read landing after it
          then overwrites. Under a list that failed to read it offers a second failure instead. */}
      {role === 'organizer' && montages !== null ? (
        <View style={styles.pad}>
          <ActionBar>
            <Button
              variant="primary"
              wide
              label={s.montage.make}
              onPress={() => setOrdering(true)}
              disabled={busy}
            />
          </ActionBar>
        </View>
      ) : null}

      {/* The three wishes doc-03 allows and nothing else, asked on a sheet the way an invite is:
          ordering is a thing done once, and the face is for what comes of it. What is picked is
          in the heading above each row as well as in the buttons — a screen reader gets no «this
          one is chosen» out of a button that only looks different. */}
      <Sheet visible={ordering} onCancel={() => setOrdering(false)}>
        <Text accessibilityRole="header" role="title">
          {s.montage.make}
        </Text>
        <Text role="meta">{s.montage.explain}</Text>

        <Text role="label">
          {s.montage.howLong} · {s.montage.length[seconds]}
        </Text>
        <View style={styles.choices}>
          {LENGTHS.map((length) => (
            <Button
              key={length}
              sm
              // The picked one is the one with a frame around it. Not `primary`: the glow belongs
              // to one thing on a surface, and here that is «Make it» at the bottom.
              variant={length === seconds ? 'secondary' : 'quiet'}
              label={s.montage.length[length]}
              onPress={() => setSeconds(length)}
              disabled={busy}
            />
          ))}
        </View>

        <Text role="label">
          {s.montage.music} · {s.montage.track[track]}
        </Text>
        <View style={styles.choices}>
          {(Object.keys(s.montage.track) as MusicTrackId[]).map((id) => (
            <Button
              key={id}
              sm
              variant={id === track ? 'secondary' : 'quiet'}
              label={s.montage.track[id]}
              onPress={() => setTrack(id)}
              disabled={busy}
            />
          ))}
        </View>

        <Text role="label">
          {s.montage.shape} · {s.montage.orientation[orientation]}
        </Text>
        <View style={styles.choices}>
          {(Object.keys(s.montage.orientation) as MontageOrientation[]).map((way) => (
            <Button
              key={way}
              sm
              variant={way === orientation ? 'secondary' : 'quiet'}
              label={s.montage.orientation[way]}
              onPress={() => setOrientation(way)}
              disabled={busy}
            />
          ))}
        </View>

        {/* `busy` alone, as everywhere else in the app: the kit already refuses the press while it
            is set, and adding `disabled` on top would take the ember off the one glowing button on
            the sheet for exactly as long as its spinner is turning. */}
        <Button variant="primary" label={s.montage.makeIt} onPress={order} busy={busy} />
        {/* Where «too little material» is read: the sheet stays up when the order is refused, and
            the face's own copy of this line is under the scrim. */}
        {notice ? <Banner text={notice} /> : null}
      </Sheet>

      {/* The finished video played where it lies, the way the frames face plays a preview:
          `expo-video` streams it from the signed link rather than downloading it first. A modal and
          not a screen — there is nothing to do in here but watch it and close it. */}
      <Modal
        visible={watching !== null}
        animationType="fade"
        onRequestClose={() => setPlaying(null)}
        // Landscape too: a montage is 16:9 and worth turning the phone for, and the rest of the
        // app is portrait-only.
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
 * The kit pins `.viewer` to the dark set in every theme (kit.html, block 0.2): «вокруг фотографии
 * не должно быть ничего светлее её самой». `frames.tsx` says the same at more length — the two faces
 * draw the same viewer, and this is the one value in this sheet that has an opinion.
 *
 * So nothing here turns with the theme, and the sheet is a plain one: the list this face draws is
 * cards from the kit on the screen's own background, and both of those already turn by themselves.
 */
const room = themes.dark.color;

const styles = StyleSheet.create({
  // The sides belong to the face and not to the scroll, so the bar at the bottom stands in the same
  // margin the cards do — the kit's 16, which is what the head above uses too.
  body: { paddingHorizontal: space.s4, paddingBottom: space.s8, gap: space.s3 },
  pad: { paddingHorizontal: space.s4 },
  notice: { marginHorizontal: space.s4 },
  // A card and, under a fallen one, the line the worker left — closer to each other than the
  // face's own gap, because they are one thing.
  montage: { gap: space.s2 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  viewer: { flex: 1, backgroundColor: room.ink, justifyContent: 'center' },
  bar: { justifyContent: 'center', paddingHorizontal: space.s4 },
  big: { flex: 1, width: '100%' },
});
