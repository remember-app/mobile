import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ChevronLeft, Download, Film, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Modal, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  errorMessage,
  listMemories,
  listMontages,
  orderMontage,
  retryMontage,
  type Memory,
  type Montage,
  type MusicTrackId,
} from '@/api';
import { useAuth } from '@/auth';
import { formatDay, formatRuntime } from '@/dates';
import { maySaveToPhone, saveToPhone } from '@/downloads';
import {
  ActionBar,
  AppBar,
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
import { type Strings } from '@/strings';
import { space, themes } from '@/theme';

/** The four standings a montage can be in, in the three the kit draws (section 10). */
const MONTAGE_STATE: Record<Montage['status'], MontageState> = {
  queued: 'pending',
  processing: 'pending',
  ready: 'ready',
  failed: 'failed',
};

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
 * The videos of one memory: what has been made, what is being made, and — for the organizer — the
 * asking for one more. Its own screen and not a block over the roster (TASK-64): «ролики не
 * смешиваются с галереей» (doc-03), and neither do they with the guest list.
 *
 * Behind no role at all: the video is what everybody who brought material gets back, so a viewer
 * reads the list too. Only the organizer orders one, and only the organizer starts a fallen one
 * again — the api is the authority on that, and the level is read off the memory it hands over.
 */
export default function MontageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const insets = useSafeAreaInsets();
  // null means «not loaded yet» — the same distinction the other screens draw, so a refetch after
  // an order keeps the cards on screen instead of flashing the spinner over them.
  const [memory, setMemory] = useState<Memory | null>(null);
  const [montages, setMontages] = useState<Montage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [montageError, setMontageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  // What the order will ask for. The api's own default length, and a track chosen rather than left
  // to the worker — it is one tap either way, and a person who opened the sheet came to choose.
  const [seconds, setSeconds] = useState<Length>(60);
  const [track, setTrack] = useState<MusicTrackId>('warm');
  /** The montage being watched, held by id so a reload hands it a fresh signed url. */
  const [playing, setPlaying] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    setMontageError(null);
    // The montage list carries neither the memory's title nor the caller's level, so the list the
    // home screen already reads answers for both — the road the gallery takes, and it works the
    // same however this screen was reached, which nav params would not.
    listMemories(token).then(
      (memories) => setMemory(memories.find((one) => one.id === id) ?? null),
      (e: unknown) => setError(errorMessage(e)),
    );
    // Beside that one rather than in it: the montage list is the call that answers 503 over a
    // bucket nobody configured, and that must not take the title and the way out with it.
    listMontages(token, id).then(setMontages, (e: unknown) => setMontageError(errorMessage(e)));
  }, [token, id]);

  // On focus rather than on mount, the way the home screen does it — and here it is the montages
  // that need it: a queued one only ever changes on the worker's side, and `video_url` is signed
  // for a quarter of an hour. Coming back from anywhere re-reads both, instead of leaving a card
  // that has been stale since whenever this screen was first opened.
  useFocusEffect(load);

  const role = memory?.role ?? null;
  const watching = montages?.find((montage) => montage.id === playing) ?? null;

  /**
   * Every api call this screen's buttons make is the same shape: lock the controls, run one call,
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
   * «Смонтируй ролик», with the two wishes doc-03 allows. The api answers with the row it wrote,
   * so it goes straight onto the top of the list — the list is newest first, and a reload would be
   * the same thing one round trip later.
   */
  const order = () =>
    act(
      async (session) => {
        const ordered = await orderMontage(session, id, {
          target_seconds: seconds,
          music_track_id: track,
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
    <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top }]}>
      <AppBar
        title={memory?.title ?? s.montage.title}
        left={
          <IconButton
            icon={ChevronLeft}
            label={s.action.back}
            // A tapped «ролик готов» push opens this screen with nothing behind it to go back to.
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        }
        right={
          // The other half of the memory, one icon away — the same corner the gallery reaches its
          // members from. `navigate` and not `push`: the two screens point at each other, and
          // pushing would stack a fresh copy of one over the other on every hop.
          <IconButton
            icon={Users}
            label={s.members.title}
            onPress={() => router.navigate({ pathname: '/memory/[id]', params: { id } })}
          />
        }
      />

      {error !== null ? (
        <Banner tone="error" text={error}>
          <Button sm variant="quiet" label={s.action.retry} onPress={load} />
        </Banner>
      ) : null}
      {montageError !== null ? (
        <Banner tone="error" text={montageError}>
          <Button sm variant="quiet" label={s.action.retry} onPress={load} />
        </Banner>
      ) : null}

      {/* Beside the list and not in place of it: `load` runs on every focus, so a list that was
          read once outlives a refetch that failed. Wiping it would take the videos and the
          organizer's own way of ordering one off the screen over a blip. */}
      {montages === null ? (
        montageError === null ? <Empty busy text={s.state.loading} /> : null
      ) : (
        <>
          {montages.map((montage) => (
            <View key={montage.id} style={styles.montage}>
              <CardMontage
                state={MONTAGE_STATE[montage.status]}
                title={montageTitle(montage, s)}
                status={s.montage.status[montage.status]}
                // Said in place of a bar or a number: nothing on this side knows how far along the
                // worker is, and the push is what actually brings people back to look.
                caption={s.montage.caption}
                playLabel={s.montage.watch(montageTitle(montage, s))}
                onPlay={montage.video_url === null ? undefined : () => setPlaying(montage.id)}
                actions={
                  montage.status === 'ready' ? (
                    <Button
                      sm
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
                  beside the dot stays the screen's, and the worker's own line goes under the card,
                  where there is room for it and where it is not the first thing read. */}
              {montage.status === 'failed' && montage.error_text !== null ? (
                <Text role="meta">{montage.error_text}</Text>
              ) : null}
            </View>
          ))}

          {/* Nothing until the memory has answered: `role` comes off it, the two calls race, and
              this pair is the one place where not knowing yet reads as an answer — an organizer
              would be shown «the organizer can ask for one» and no button to do it with. The cards
              above need no role and go up as soon as they arrive. */}
          {memory === null ? null : role === 'organizer' ? (
            // The screen's one glowing button for the organizer: doc-03 makes ordering theirs
            // alone, and it is the thing the whole memory is being filled up for.
            <Button
              variant="primary"
              label={s.montage.make}
              onPress={() => setOrdering(true)}
              disabled={busy}
            />
          ) : montages.length === 0 ? (
            <Empty icon={Film} text={s.montage.empty} />
          ) : null}
        </>
      )}

      {notice ? <Banner text={notice} /> : null}

      {/* The two wishes doc-03 allows and nothing else, asked on a sheet the way an invite is:
          ordering is a thing done once, and the screen is for what comes of it. What is picked is
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

        {/* `busy` alone, as everywhere else in the app: the kit already refuses the press while it
            is set, and adding `disabled` on top would take the ember off the one glowing button on
            the sheet for exactly as long as its spinner is turning. */}
        <Button variant="primary" label={s.montage.makeIt} onPress={order} busy={busy} />
        {/* Where «too little material» is read: the sheet stays up when the order is refused, and
            the screen's own copy of this line is under the scrim. */}
        {notice ? <Banner text={notice} /> : null}
      </Sheet>

      {/* The finished video played where it lies, the way the gallery plays a preview: `expo-video`
          streams it from the signed link rather than downloading it first. A modal and not a screen
          — there is nothing to do in here but watch it and close it. */}
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
            <Playing url={watching.video_url} />
            <ActionBar style={styles.bar}>
              <Button variant="quiet" label={s.action.close} onPress={() => setPlaying(null)} />
            </ActionBar>
          </View>
        )}
      </Modal>
    </ScrollView>
  );
}

/**
 * The montage, played from its signed link. Its own component because the player is a hook, and
 * this one is mounted only while the video is on screen — leaving it releases the player.
 *
 * The gallery has these same three lines for its previews, down to the style. Not shared, and not
 * because the two differ: both files are expo-router routes, and a route is not somewhere to
 * import a component from — the alternative is a module of its own around one `useVideoPlayer`
 * call. Worth making the moment a third screen plays a video, or the moment these two disagree.
 */
function Playing({ url }: { url: string }) {
  const player = useVideoPlayer(url, (video) => video.play());
  return <VideoView player={player} style={styles.big} />;
}

/**
 * The kit pins `.viewer` to the dark set in every theme (kit.html, block 0.2): «вокруг фотографии
 * не должно быть ничего светлее её самой». `gallery.tsx` says the same at more length — the two
 * screens draw the same viewer, and this is the one value in this sheet that has an opinion.
 *
 * So nothing here turns with the theme, and the sheet is a plain one: the list this screen draws is
 * cards from the kit on the layout's own background, and both of those already turn by themselves.
 */
const room = themes.dark.color;

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.s5, paddingBottom: space.s8, gap: space.s3 },
  // A card and, under a fallen one, the line the worker left — closer to each other than the
  // screen's own gap, because they are one thing.
  montage: { gap: space.s2 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  viewer: { flex: 1, backgroundColor: room.ink, justifyContent: 'center' },
  bar: { justifyContent: 'center', paddingHorizontal: space.s4 },
  big: { flex: 1, width: '100%' },
});
