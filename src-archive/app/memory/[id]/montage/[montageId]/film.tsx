import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Download, Share } from 'lucide-react-native';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ApiError,
  deleteMontage,
  errorMessage,
  listMembers,
  listMemories,
  listMontages,
  type Memory,
  type Montage,
  markWatched,
  renameMontage,
} from '@/api';
import {
  Banner,
  Board,
  Button,
  ConfirmSheet,
  FilmStageDivider,
  FilmStageList,
  GlassBar,
  IconButton,
  PosterFilm,
  RowFilmStage,
  Shares,
  Text,
  TileNumber,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { useStrings } from '@/lib/language';
import {
  howMade,
  madeInMinutes,
  stageLine,
  stageNumber,
  stageStanding,
  useMontageJournal,
  WHILE_LIVE_MS,
} from '@/lib/montage/journal';
import { cutAs, FilmInfoSheet, FilmNameSheet } from '@/screens/memory/film-info';
import { FilmPlayer, useFilmActions } from '@/screens/memory/film-player';
import { MontageGone } from '@/screens/memory/montage-gone';
import { height, space } from '@/theme';

type Up = 'info' | 'name' | 'remove';
export default function FilmScreen() {
  const { id, montageId } = useLocalSearchParams<{
    id: string;
    montageId: string;
  }>();
  const router = useRouter();
  const { token } = useAuth();
  const s = useStrings();
  const journal = useMontageJournal(token, id, montageId);
  const [montage, setMontage] = useState<Montage | null>(null);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [people, setPeople] = useState<number | undefined>(undefined);
  const [listed, setListed] = useState<'read' | 'lost' | 'refused' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [up, setUp] = useState<Up | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const { busy: keeping, notice, run } = useFilmActions();
  const focused = useIsFocused();
  const told = useRef(false);
  const read = useCallback(() => {
    if (!token) return;
    Promise.all([listMontages(token, id), listMemories(token), listMembers(token, id)]).then(
      ([films, memories, members]) => {
        setMontage(films.find((one) => one.id === montageId) ?? null);
        setMemory(memories.find((one) => one.id === id) ?? null);
        setPeople(members.length);
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
  async function remove() {
    if (!token) return;
    setBusy(true);
    setFailed(null);
    try {
      await deleteMontage(token, id, montageId);
      setUp(null);
      back();
    } catch (e) {
      setUp(null);
      setFailed(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (journal.standing === 'refused' || listed === 'refused')
    return <MontageGone title={s.montage.live.doneTitle} onBack={back} />;
  const name = montage?.name ?? '';
  const film = montage?.video_url ? montage : null;
  const tiles = howMade(journal.stages, s);
  const said = up === 'name' ? null : (failed ?? notice);
  return (
    <View style={styles.screen}>
      <Board
        style={styles.bleed}
        body={styles.body}
        footer={said ? <Banner text={said} style={styles.said} /> : undefined}
      >
        <PosterFilm
          poster={montage?.poster_url}
          meta={montage === null ? undefined : cutAs(montage)}
          ready={ready ? s.montage.filmScreen.readyPill : undefined}
          label={s.montage.watch(name)}
          onPress={film === null ? undefined : () => setPlaying(true)}
        />

        <Shares>
          <Button
            variant="primary"
            size="sm"
            wide
            icon={Share}
            label={s.action.share}
            disabled={keeping || film === null}
            onPress={() => film && void run(film, 'share')}
          />
          <Button
            size="sm"
            wide
            icon={Download}
            label={s.action.download}
            disabled={keeping || film === null}
            onPress={() => film && void run(film, 'save')}
          />
        </Shares>

        {journal.standing === 'offline' || listed === 'lost' ? (
          <Banner text={s.montage.live.lost} style={styles.aside} />
        ) : null}

        {journal.stages.length === 0 ? null : (
          <View style={styles.made}>
            <View style={styles.madeHead}>
              <Text role="subtitleDisplay" accessibilityRole="header">
                {s.montage.live.howMade}
              </Text>
              <Text role="meta">
                {s.montage.filmScreen.howMadeTook(
                  journal.stages.length,
                  madeInMinutes(journal.stages),
                )}
              </Text>
            </View>
            {tiles.length === 0 ? null : (
              <Shares>
                {tiles.map((tile) => (
                  <TileNumber key={tile.label} figure={String(tile.figure)} label={tile.label} />
                ))}
              </Shares>
            )}
            <FilmStageList>
              {journal.stages.map((stage, i) => (
                <Fragment key={stage.stage}>
                  {i > 0 ? <FilmStageDivider /> : null}
                  <RowFilmStage
                    at={stageNumber(stage.stage)}
                    title={s.montage.stage[stage.stage]}
                    meta={stageLine(stage, s)}
                    state={stageStanding(stage)}
                    onPress={() =>
                      router.push({
                        pathname: '/memory/[id]/montage/[montageId]/stage/[stage]',
                        params: { id, montageId, stage: stage.stage },
                      })
                    }
                  />
                </Fragment>
              ))}
            </FilmStageList>
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
            label={s.montage.filmScreen.backToMemory}
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

      {montage ? (
        <FilmInfoSheet
          visible={up === 'info'}
          film={montage}
          memory={memory}
          people={people}
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
const styles = StyleSheet.create({
  screen: { flex: 1 },
  bleed: { paddingTop: 0 },
  body: { flexGrow: 1, paddingBottom: space.s6 },
  made: { paddingHorizontal: space.s4, paddingTop: space.s3, gap: space.s3 },
  madeHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: space.s2,
    paddingHorizontal: 2,
  },
  aside: { marginHorizontal: space.s4, marginTop: space.s3 },
  said: { marginHorizontal: space.s4, marginBottom: space.s3 },
  glass: { position: 'absolute', left: 0, right: 0, top: 0 },
});
