import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Download, Share } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ApiError,
  deleteMontage,
  errorMessage,
  listMemories,
  listMontages,
  type Memory,
  type Montage,
  markWatched,
  renameMontage,
} from '@/api';
import {
  ActionBar,
  Banner,
  Board,
  Button,
  ConfirmSheet,
  GlassBar,
  IconButton,
  PosterFilm,
  Shares,
  Text,
  TileNumber,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { useStrings } from '@/lib/language';
import { howMade, madeInMinutes, useMontageJournal, WHILE_LIVE_MS } from '@/lib/montage/journal';
import { cutAs, FilmInfoSheet, FilmNameSheet } from '@/screens/memory/film-info';
import { FilmPlayer, useFilmActions } from '@/screens/memory/film-player';
import { MontageGone } from '@/screens/memory/montage-gone';
import { StageRows } from '@/screens/memory/stage-rows';
import { height, space } from '@/theme';

/** Which sheet is up over the film — one at a time, so one never has to close under another. */
type Up = 'info' | 'name' | 'remove';

/**
 * `Film` (spec 8, 27 сентября) — a finished film's own screen, where its card in the strip leads.
 * The film first: its poster from the top edge of the phone, the press that plays it, and «Сохранить
 * на телефон» at the foot; then how it was cut — «Как собирался», the three numbers and the five
 * stages, each the way into its journal. The glass bar stands over it all: back, the capsule with the
 * film's name that raises what it is (`SheetFilmInfo`), and «Поделиться».
 *
 * Opening a finished film is watching it, as far as «Посмотрели» goes: the screen tells the api so,
 * once, and reads the list again for the sheet to count this reader in.
 *
 * Every member reads it, a viewer included; renaming the film and deleting it are the organizer's,
 * and nobody else is shown either.
 */
export default function FilmScreen() {
  const { id, montageId } = useLocalSearchParams<{ id: string; montageId: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const s = useStrings();
  const journal = useMontageJournal(token, id, montageId);
  const [montage, setMontage] = useState<Montage | null>(null);
  const [memory, setMemory] = useState<Memory | null>(null);
  /** How the last read went: `lost` comes back by itself, `refused` is the api's 404. */
  const [listed, setListed] = useState<'read' | 'lost' | 'refused' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [up, setUp] = useState<Up | null>(null);
  /** A rename or a delete in the air. */
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const { busy: keeping, notice, run } = useFilmActions();
  const focused = useIsFocused();
  const told = useRef(false);

  /**
   * The film out of its memory's list — there is no route for one — and the memory itself, for its
   * name in the capsule, its counts in the sheet and the reader's level. On focus: `video_url` is
   * signed for a quarter of an hour.
   */
  const read = useCallback(() => {
    if (!token) return;
    Promise.all([listMontages(token, id), listMemories(token)]).then(
      ([films, memories]) => {
        setMontage(films.find((one) => one.id === montageId) ?? null);
        setMemory(memories.find((one) => one.id === id) ?? null);
        setListed('read');
      },
      (e: unknown) => setListed(e instanceof ApiError && e.status === 404 ? 'refused' : 'lost'),
    );
  }, [token, id, montageId]);

  useEffect(() => {
    if (!focused || listed !== 'lost') return;
    const timer = setInterval(read, WHILE_LIVE_MS);
    return () => clearInterval(timer);
  }, [focused, listed, read]);

  useFocusEffect(
    useCallback(() => {
      read();
      return () => setPlaying(false);
    }, [read]),
  );

  const ready = montage?.status === 'ready';
  useEffect(() => {
    if (!token || !ready || told.current) return;
    told.current = true;
    markWatched(token, id, montageId).then(read, (e: unknown) =>
      console.warn(`watched mark fails for montage ${montageId}:`, errorMessage(e)),
    );
  }, [token, ready, id, montageId, read]);

  const back = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/memory/[id]', params: { id } });

  /** The name as the sheet sent it, and the sheet gone once the api has taken it. */
  async function rename(name: string) {
    if (!token) return;
    setBusy(true);
    setFailed(null);
    try {
      const renamed = await renameMontage(token, id, montageId, name);
      setMontage((was) => was && { ...was, name: renamed.name });
      setUp(null);
    } catch (e) {
      setFailed(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** Gone for good, and back to the feed it stood in — the strip reads itself again on the way. */
  async function remove() {
    if (!token) return;
    setBusy(true);
    setFailed(null);
    try {
      await deleteMontage(token, id, montageId);
      setUp(null);
      back();
    } catch (e) {
      // The sheet goes and the refusal is said on the screen, the way deleting a memory does.
      setUp(null);
      setFailed(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (journal.standing === 'refused' || listed === 'refused')
    return <MontageGone title={s.montage.live.doneTitle} onBack={back} />;

  const name = montage?.name ?? '';
  /** The film once there is a link to it — what «смотреть», «Сохранить» and «Поделиться» all need. */
  const film = montage?.video_url ? montage : null;
  const tiles = howMade(journal.stages, s);
  const said = up === 'name' ? null : (failed ?? notice);

  return (
    <View style={styles.screen}>
      <Board
        // The poster runs under the status line: the glass bar floats over it and stays.
        style={styles.bleed}
        body={styles.body}
        footer={
          <>
            {said ? <Banner text={said} style={styles.said} /> : null}
            <ActionBar>
              <Button
                variant="primary"
                wide
                icon={Download}
                label={s.viewer.saveToPhone}
                busy={keeping}
                disabled={film === null}
                onPress={() => film && void run(film, 'save')}
              />
            </ActionBar>
          </>
        }
      >
        <PosterFilm
          poster={montage?.poster_url}
          meta={montage === null ? undefined : cutAs(montage)}
          label={s.montage.watch(name)}
          onPress={film === null ? undefined : () => setPlaying(true)}
        />

        {journal.standing === 'offline' || listed === 'lost' ? (
          <Banner text={s.montage.live.lost} style={styles.aside} />
        ) : null}

        {/* «Как собирался» — the main block after the film itself (detail 56, the large rows). A
            film cut before the journal existed has none, and the block is simply not here. */}
        {journal.stages.length === 0 ? null : (
          <View style={styles.made}>
            <View style={styles.madeHead}>
              <Text role="subtitleDisplay" accessibilityRole="header">
                {s.montage.live.howMade}
              </Text>
              <Text role="meta">
                {s.montage.film.took(journal.stages.length, madeInMinutes(journal.stages))}
              </Text>
            </View>
            {tiles.length === 0 ? null : (
              <Shares>
                {tiles.map((tile) => (
                  <TileNumber key={tile.label} figure={String(tile.figure)} label={tile.label} />
                ))}
              </Shares>
            )}
            <StageRows large memoryId={id} montageId={montageId} journal={journal} />
          </View>
        )}
      </Board>

      <GlassBar
        bare
        style={styles.glass}
        title={name}
        meta={memory?.title}
        capsuleLabel={s.montage.film.about(name)}
        onCapsule={montage === null ? undefined : () => setUp('info')}
        left={
          <IconButton
            icon={ChevronLeft}
            label={s.mine.back}
            tone="glass"
            size={height.roundViewer}
            onPress={back}
          />
        }
        right={
          <IconButton
            icon={Share}
            label={s.montage.film.share}
            tone="glass"
            size={height.roundViewer}
            glyph={{ size: 20 }}
            disabled={keeping || film === null}
            onPress={() => film && void run(film, 'share')}
          />
        }
      />

      <FilmPlayer film={playing ? film : null} onClose={() => setPlaying(false)} />

      {up === 'info' && montage ? (
        <FilmInfoSheet
          film={montage}
          memory={memory}
          taken={journal.stages.find((one) => one.stage === 'directing')?.outcome.frames}
          mayEdit={memory?.role === 'organizer'}
          onRename={() => {
            setFailed(null);
            setUp('name');
          }}
          onRemove={() => {
            setFailed(null);
            setUp('remove');
          }}
          onClose={() => setUp(null)}
        />
      ) : null}

      {up === 'name' && montage ? (
        <FilmNameSheet
          name={montage.name}
          busy={busy}
          error={failed}
          onSave={(next) => void rename(next)}
          onClose={() => {
            setFailed(null);
            setUp(null);
          }}
        />
      ) : null}

      {/* The price is not settled yet — whether the journal goes with the film (spec 10.9, п. 12) —
          so the sheet says no more than its question and which film it is about. */}
      <ConfirmSheet
        visible={up === 'remove'}
        thumb={montage?.poster_url ?? undefined}
        title={s.montage.film.removeAsk}
        meta={[name, memory?.title].filter(Boolean).join(' · ')}
        confirmLabel={s.action.delete}
        cancelLabel={s.gallery.keep}
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setUp(null)}
      />
    </View>
  );
}

// Nothing here carries a colour of its own — every piece on this screen brings the kit's with it.
const styles = StyleSheet.create({
  screen: { flex: 1 },
  bleed: { paddingTop: 0 },
  body: { flexGrow: 1, paddingBottom: space.s6 },
  // Spec 8, `Film`: «Как собирался» from 312 — 12 under the poster — in the screen's 16, 12 apart.
  made: { paddingHorizontal: space.s4, paddingTop: space.s3, gap: space.s3 },
  // The heading and «5 этапов · 14 мин» on one baseline, 2 in from the column; the count goes under
  // the heading rather than squeeze it once the two no longer share a line.
  madeHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: space.s2,
    paddingHorizontal: 2,
  },
  aside: { marginHorizontal: space.s4, marginTop: space.s3 },
  // What a press answered with stands over the bottom layer, where it is not scrolled away.
  said: { marginHorizontal: space.s4, marginBottom: space.s3 },
  glass: { position: 'absolute', left: 0, right: 0, top: 0 },
});
