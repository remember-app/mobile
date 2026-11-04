import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ApiError,
  errorMessage,
  listMontages,
  type Memory,
  type Montage,
  retryMontage,
} from '@/api';
import {
  BadgeMontage,
  Banner,
  Button,
  CardMontage,
  CardMontageNew,
  EmptyMontages,
  type MontageState,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatDay } from '@/lib/dates';
import { keepReady } from '@/lib/frames';
import { useStrings } from '@/lib/language';
import { currentStage, STAGE_COUNT, stageNumber } from '@/lib/montage/journal';
import { beingMade, trackWords, WHILE_MAKING_MS } from '@/lib/montage/order';
import { FilmPlayer } from '@/screens/memory/film-player';
import { BlockHead } from '@/screens/memory/head';
import type { Strings } from '@/strings';
import { height, space } from '@/theme';

const MONTAGE_STATE: Record<Montage['status'], MontageState> = {
  queued: 'pending',
  processing: 'pending',
  ready: 'ready',
  failed: 'failed',
};
const stillMaking = (montages: readonly Montage[] | null) =>
  montages?.some((montage) => beingMade(montage.status)) ?? false;
function stepOf(montage: Montage, s: Strings) {
  const stage = currentStage(montage.stages ?? []);
  if (stage === null) return undefined;
  const at = stageNumber(stage.stage);
  const step = { at, of: STAGE_COUNT, count: s.montage.live.doneOf(at, STAGE_COUNT) };
  return stage.state === 'failed' ? { ...step, failed: true } : step;
}
function madeOf(montage: Montage, s: Strings): string {
  const { orientation } = montage.params;
  return [
    formatDay(montage.created_at),
    orientation ? s.montage.orientation[orientation] : null,
    ...trackWords(montage.params, s),
  ]
    .filter(Boolean)
    .join(' · ');
}
export function Films({ id, memory }: { id: string; memory: Memory | null }) {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const [montages, setMontages] = useState<Montage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { montage: asked } = useLocalSearchParams<{
    montage?: string;
  }>();
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => {
    if (!asked) return;
    setPlaying(asked);
    router.setParams({ montage: '' });
  }, [asked, router]);
  const writes = useRef(0);
  const load = useCallback(
    (quiet = false) => {
      if (!token) return;
      if (!quiet) setError(null);
      const startedAt = writes.current;
      listMontages(token, id).then(
        (list) => {
          if (quiet && writes.current !== startedAt) return;
          setMontages((have) => (quiet ? keepReady(have, list) : list));
          setError(null);
        },
        (e: unknown) => {
          if (!quiet) setError(errorMessage(e));
        },
      );
    },
    [token, id],
  );
  useFocusEffect(
    useCallback(() => {
      load();
      return () => setPlaying(null);
    }, [load]),
  );
  const making = stillMaking(montages);
  const focused = useIsFocused();
  useEffect(() => {
    if (!making || !focused) return;
    const timer = setInterval(() => load(true), WHILE_MAKING_MS);
    return () => clearInterval(timer);
  }, [making, focused, load]);
  const role = memory?.role ?? null;
  const watching = montages?.find((montage) => montage.id === playing) ?? null;
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
  const askForOne = () => router.push({ pathname: '/memory/[id]/order', params: { id } });
  const watchMaking = (montage: Montage) =>
    router.push({
      pathname: '/memory/[id]/montage/[montageId]',
      params: { id, montageId: montage.id },
    });
  const openFilm = (montage: Montage) =>
    router.push({
      pathname: '/memory/[id]/montage/[montageId]/film',
      params: { id, montageId: montage.id },
    });
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
          if (e instanceof ApiError && e.status === 409) load();
          throw e;
        }
      },
      {
        409: s.montage.movedOn,
        403: s.montage.retryDenied,
      },
    );
  return (
    <View style={styles.block}>
      <BlockHead
        title={s.montage.title}
        style={styles.head}
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
          <Button size="xs" variant="quiet" label={s.action.retry} onPress={() => load()} />
        </Banner>
      ) : montages === null ? null : montages.length === 0 ? (
        <EmptyMontages
          style={styles.aside}
          photos={memory?.recent_thumbnail_urls}
          text={s.montage.emptyNote}
        >
          {role === 'organizer' ? (
            <Button
              variant="paper"
              size="mini"
              wide={false}
              icon={Plus}
              label={s.montage.makeIt}
              onPress={askForOne}
            />
          ) : null}
        </EmptyMontages>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {role === 'organizer' ? (
            <CardMontageNew label={s.montage.newOne} onPress={askForOne} />
          ) : null}

          {montages.map((montage) => {
            const state = MONTAGE_STATE[montage.status];
            return (
              <CardMontage
                key={montage.id}
                state={state}
                title={montage.name}
                meta={state === 'ready' ? madeOf(montage, s) : undefined}
                caption={state === 'failed' ? montage.error_text || s.montage.broke : undefined}
                poster={montage.poster_url ?? undefined}
                badge={<BadgeMontage sm state={state} label={s.montage.status[montage.status]} />}
                step={stepOf(montage, s)}
                onPress={state === 'ready' ? () => openFilm(montage) : () => watchMaking(montage)}
              >
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

      {notice ? <Banner text={notice} style={styles.aside} /> : null}

      <FilmPlayer film={watching} onClose={() => setPlaying(null)} />
    </View>
  );
}
const styles = StyleSheet.create({
  block: { gap: 10 },
  head: { minHeight: height.filmsHead },
  strip: { flexDirection: 'row', gap: space.s2, paddingHorizontal: space.s4 },
  aside: { marginHorizontal: space.s4 },
});
