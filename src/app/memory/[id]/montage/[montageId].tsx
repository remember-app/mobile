import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { errorMessage, listMemories, listMontages, type Memory, type Montage } from '@/api';
import { useAuth } from '@/auth';
import { formatRuntime } from '@/dates';
import {
  ActionBar,
  AppBar,
  Banner,
  Board,
  Button,
  IconButton,
  Mosaic,
  RowStep,
  Spinner,
  Text,
} from '@/kit';
import { useStrings } from '@/language';
import { beingMade, LENGTHS, stages, WHILE_MAKING_MS, type Length } from '@/montage';
import { type Strings } from '@/strings';
import { photo, radius, space, themed } from '@/theme';

/**
 * `MontageProgress` (spec 8) — the screen an order lands on while the video is being made. Not the
 * list with one card saying «Собирается» on it: what was just asked for is the only thing on the
 * mind of whoever asked, and it gets a screen — the material it is being cut from under a solid,
 * what was ordered, and how far along it is in stages rather than in a number.
 *
 * Stages and not per cent, which is the spec's own rule: «73 %» says nothing to a person and
 * «Режиссёр строит историю» says where it is. The api has no per-stage progress to hand out anyway —
 * one word about the whole job — so what the rows say is what is actually known; `@/montage` is
 * where that reasoning lives.
 *
 * A route of one montage rather than a face of the memory: the movies of a memory are a face of it
 * (TASK-101) and this is one of them, watched. Reached by `replace` from the order wizard, so the
 * way back from here is the memory and never the four steps of an order already sent.
 */
export default function MontageProgressScreen() {
  const { id, montageId, frames } = useLocalSearchParams<{
    id: string;
    montageId: string;
    /** How many frames the order took, counted by the wizard — the api never counts them back. */
    frames?: string;
  }>();
  const router = useRouter();
  const { token } = useAuth();
  const s = useStrings();
  const styles = useStyles();

  const [memory, setMemory] = useState<Memory | null>(null);
  /** null means «not read yet»: until it is, there is no standing to draw and no meta to draw. */
  const [montage, setMontage] = useState<Montage | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Whether this screen is still here — see `leave`. */
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);

  /**
   * Out of here, and the making carries on without anybody watching it — nothing on this screen
   * touches the worker. Back rather than a new screen: this one replaced the wizard, so what is
   * under it is the memory on its movies face, which reads its list again as it comes forward.
   *
   * Never once this screen has gone: the read below calls it too, and a read still in flight when
   * somebody pressed «К воспоминанию» would answer after that — `router` is the app's own, so a
   * second `back()` would pop the memory out from under them as well (found in review).
   */
  const leave = useCallback(() => {
    if (gone.current) return;
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/memory/[id]', params: { id, face: 'films' } });
  }, [router, id]);

  // The name over the screen and the four frames under the solid, off the listing every screen of a
  // memory reads. Once, on the way in: neither of them changes while a video is being cut. A failure
  // here is left unsaid — the bar has a word to stand under and the mosaic is a picture; the montage
  // below is what this screen is about, and it speaks for itself.
  useEffect(() => {
    if (!token) return;
    listMemories(token).then(
      (memories) => setMemory(memories.find((one) => one.id === id) ?? null),
      () => {},
    );
  }, [token, id]);

  /**
   * The montage as it now stands. There is no route for one montage — the api lists them — so this
   * is the same read the movies face makes, picked down to the row this screen is watching.
   *
   * `quiet` is the same distinction that face draws: the read on the way in speaks up when it
   * fails, the ones that happen on their own every few seconds do not, or a blip on the way would
   * put a banner over a screen that is fine.
   */
  const read = useCallback(
    (quiet = false) => {
      if (!token) return;
      listMontages(token, id).then(
        (list) => {
          const mine = list.find((one) => one.id === montageId);
          // Gone from the list — the montage or the memory itself was deleted while this screen
          // stood over it. There is nothing left to wait for, and the memory is where that is said.
          if (!mine) leave();
          else {
            setMontage(mine);
            setError(null);
          }
        },
        (e: unknown) => {
          if (!quiet) setError(errorMessage(e));
        },
      );
    },
    [token, id, montageId, leave],
  );

  useFocusEffect(useCallback(() => read(), [read]));

  // And again every few seconds while the worker still owes this one — the same loop the movies face
  // runs over its list (TASK-125), here over the one row. Only while it is still being made: the
  // moment it is ready or has fallen over, nothing more is coming.
  const making = montage === null || beingMade(montage.status);
  useEffect(() => {
    if (!making) return;
    // An interval and not a timeout chained off each read: one read failing on a bad connection
    // would end the chain, and end it silently.
    const timer = setInterval(() => read(true), WHILE_MAKING_MS);
    return () => clearInterval(timer);
  }, [making, read]);

  // Ready while somebody sat here watching — which is the whole point of sitting here. The reward is
  // the video itself and it is played on the movies face, so this screen steps out of the way rather
  // than growing a second player: the face reads its list as it comes forward and the card is there,
  // with its poster and its «Сохранить и поделиться».
  useEffect(() => {
    if (montage?.status === 'ready') leave();
  }, [montage?.status, leave]);

  const broke = montage?.status === 'failed';

  return (
    <Board>
      <AppBar
        title={memory?.title ?? s.memory.fallbackTitle}
        left={<IconButton icon={ChevronLeft} label={s.action.back} onPress={leave} />}
      />

      <ScrollView contentContainerStyle={styles.body}>
        {/* Spec 8: 176 of the memory's own frames with the solid over them, and the words on top.
            The material is there to be seen — the work is being done on it, not on a spinner. */}
        <View style={styles.block}>
          <Mosaic photos={memory?.recent_thumbnail_urls ?? []} layout="banner" />
          <View style={[StyleSheet.absoluteFill, styles.solid]} />
          <View style={[StyleSheet.absoluteFill, styles.middle]}>
            {/* On a photograph and not on the interface: the ring takes the viewer's own glass so
                it reads the same over the solid in both themes, and keeps its `spark` arc. */}
            {broke ? null : <Spinner size={34} track={photo.glass} />}
            <Text accessibilityRole="header" role="title" style={styles.onPhoto}>
              {broke ? s.montage.status.failed : s.montage.building}
            </Text>
            {/* What was ordered, in the wizard's own words. Nothing until the row is read: a meta
                line about a montage nobody has read yet would be a guess. */}
            {montage === null ? null : (
              <Text role="meta" style={styles.onPhotoMeta}>
                {broke ? s.montage.broke : orderedTo(montage, frames, s)}
              </Text>
            )}
          </View>
        </View>

        {broke ? (
          <>
            {/* The worker's own line about what went wrong, where there is room for it — the kit's
                rule is that a screen names the failure and the worker explains it, never a code. */}
            {montage.error_text ? (
              <Text role="body" tone="muted">
                {montage.error_text}
              </Text>
            ) : null}
            <Text role="body" tone="muted">
              {s.montage.retryInMemory}
            </Text>
          </>
        ) : (
          <>
            <Text role="body" tone="muted">
              {s.montage.closeApp}
            </Text>
            {montage === null ? null : (
              <View>
                {stages(montage.status).map(({ stage, state }) => (
                  <RowStep
                    key={stage}
                    title={s.montage.stage[stage]}
                    state={state}
                    word={
                      state === 'done'
                        ? s.montage.stageDone
                        : state === 'running'
                          ? s.montage.stageRunning
                          : undefined
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Above the bar and outside the scroll, the way every face of a memory holds its own. */}
      {error ? <Banner tone="error" text={error} style={styles.banner} /> : null}

      <ActionBar>
        <Button label={s.montage.toMemory} onPress={leave} />
      </ActionBar>
    </Board>
  );
}

/**
 * «Минута · горизонтальный · 214 кадров» — the order as it was placed, said in the words the wizard
 * placed it in. Only what is known is named, the way a finished montage's own line is (`films.tsx`):
 * a length outside the three the wizard offers — the api's own default, or a row ordered from
 * somewhere else — is read as a running time rather than dropped, and a count nobody carried onto
 * this screen is simply left out.
 */
function orderedTo(montage: Montage, frames: string | undefined, s: Strings): string {
  const parts: string[] = [];
  const seconds = montage.params.target_seconds;
  const named = LENGTHS.includes(seconds as Length) ? s.montage.length[seconds as Length] : null;
  const length = named ?? formatRuntime(seconds ?? null);
  if (length) parts.push(length);
  if (montage.params.orientation) parts.push(s.montage.orientation[montage.params.orientation]);
  const taken = Number(frames);
  if (frames && Number.isFinite(taken)) parts.push(s.memory.frames(taken));
  return parts.join(' · ');
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Spec 8 puts the body at 124 and gives its three pieces 24 between them.
    body: {
      flexGrow: 1,
      paddingHorizontal: space.s4,
      paddingTop: space.s6,
      paddingBottom: space.s6,
      gap: space.s6,
    },
    block: {
      height: 176,
      borderRadius: radius.card,
      overflow: 'hidden',
      backgroundColor: color.surface,
    },
    // The solid that puts the mosaic out so the words on it can be read — spec 2 names this screen
    // as the one exception to «a photograph is darkened by a gradient, never by a plate».
    solid: { backgroundColor: photo.mosaic },
    middle: { alignItems: 'center', justifyContent: 'center', gap: space.s3 },
    // White on the solid whatever the theme is: these words lie on the picture, not on the interface.
    onPhoto: { color: photo.on },
    onPhotoMeta: { color: photo.dot },
    banner: { marginHorizontal: space.s4, marginBottom: space.s3 },
  }),
);
