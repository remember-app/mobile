import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { Download, Share } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ApiError, listMontages, type Montage } from '@/api';
import {
  AppBar,
  BackButton,
  BadgeMontage,
  Banner,
  Board,
  Button,
  CardMontage,
  Shares,
  Text,
  TileNumber,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { useStrings } from '@/lib/language';
import { howMade, madeInMinutes, useMontageJournal, WHILE_LIVE_MS } from '@/lib/montage/journal';
import { cutAs } from '@/screens/memory/film-info';
import { FilmPlayer, useFilmActions } from '@/screens/memory/film-player';
import { MontageGone } from '@/screens/memory/montage-gone';
import { StageRows } from '@/screens/memory/stage-rows';
import { space } from '@/theme';

/**
 * `MontageLiveDone` (spec 7.6) — the page of a finished film. The reward itself is at the top of it,
 * and under it the whole of how it came about: «Как собирался» is the journal the worker wrote while
 * cutting, and it stays with the film for ever rather than disappearing with the making of it.
 *
 * Two roads in, and the memory is under it both ways: a `replace` off the live screen the moment the
 * montage turns `ready` — the way out of that screen is not back into a making that is over — and a
 * `push` off the finished card in the memory's own strip of films, which is how anybody opens the
 * journal a week later. Every member reads it, a viewer included: the video is what everyone who
 * brought material gets back, and so is the story of how it was made.
 *
 * A film cut before the journal existed has none, and this screen then is the poster and the two
 * buttons — nothing is missing and nothing is wrong, there is simply nothing to tell.
 */
export default function MontageDoneScreen() {
  const { id, montageId } = useLocalSearchParams<{ id: string; montageId: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const s = useStrings();

  /**
   * The same journal the live screen read, and it is read the same way — it just no longer moves.
   * What this page draws of it is the stages: how long the making took, what each of the five came
   * to, and the way into each one's own journal.
   */
  const journal = useMontageJournal(token, id, montageId);

  const [montage, setMontage] = useState<Montage | null>(null);
  /**
   * How the last read of the list went: `lost` is a connection that will come back, `refused` the
   * api's 404 — this reader is not in the memory. Null until the first answer.
   */
  const [listed, setListed] = useState<'read' | 'lost' | 'refused' | null>(null);
  /** Whether the film is being watched — the player is the one in `film-player`, and it is a window. */
  const [playing, setPlaying] = useState(false);
  const focused = useIsFocused();

  /** Keeping the film and handing it on — the two buttons under the poster, one busy line for both. */
  const { busy, notice, run } = useFilmActions();

  /**
   * What the journal does not carry: what was ordered and how long it came out. On focus and not on
   * mount, like every other screen of a memory: `video_url` is signed for a quarter of an hour, so
   * coming back to this page an hour later re-reads the link it is watched and saved through.
   */
  const read = useCallback(() => {
    if (!token) return;
    listMontages(token, id).then(
      (list) => {
        setMontage(list.find((one) => one.id === montageId) ?? null);
        setListed('read');
      },
      (e: unknown) => setListed(e instanceof ApiError && e.status === 404 ? 'refused' : 'lost'),
    );
  }, [token, id, montageId]);

  // Lost, the list is asked again on the journal's own beat until it answers — the poster, its link
  // and both buttons hang off it, and «Связь пропала, ждём» over them promises exactly that.
  useEffect(() => {
    if (!focused || listed !== 'lost') return;
    const timer = setInterval(read, WHILE_LIVE_MS);
    return () => clearInterval(timer);
  }, [focused, listed, read]);

  // And the player is shut on the way out: a `router.push` off a tapped push leaves this screen
  // mounted behind it, and a playing film would otherwise stand over whatever came next (TASK-94).
  useFocusEffect(
    useCallback(() => {
      read();
      return () => setPlaying(false);
    }, [read]),
  );

  const title = montage?.name ?? '';
  const made = madeInMinutes(journal.stages);
  const tiles = howMade(journal.stages, s);
  /** The film once there is a link to it — what «смотреть», «Сохранить» and «Поделиться» all need. */
  const film = montage?.video_url ? montage : null;
  // The strip of films is under this page both ways in; a montage that landed here by a `replace`
  // off the live screen has the memory itself under it.
  const back = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/memory/[id]', params: { id } });

  // Either read's 404 is the same news: the poster, the buttons and the journal would all be refused.
  if (journal.standing === 'refused' || listed === 'refused') {
    return <MontageGone title={s.montage.live.doneTitle} onBack={back} />;
  }

  return (
    <Board
      bar={
        <AppBar
          variant="live"
          title={s.montage.live.doneTitle}
          // «Ролик на 2:30 · собран за 14 мин» — the film's name, and what the making of it took
          // where there is a journal to add up. No journal, no second clause: this bar never
          // guesses.
          subtitle={
            montage === null
              ? undefined
              : [title, made === null ? undefined : s.montage.live.madeIn(made)]
                  .filter(Boolean)
                  .join(' · ')
          }
          left={<BackButton label={s.action.back} onPress={back} />}
        />
      }
      body={styles.body}
    >
      {/* A read that has not come back: what was read stays as it was, and the banner goes by
          itself once both answer — «Как собирался» and the poster's link come back with them.
          First in the body, where the connection banner stands everywhere: it is about all of it. */}
      {journal.standing === 'offline' || listed === 'lost' ? (
        <Banner text={s.montage.live.lost} />
      ) : null}

      {/* Spec detail 38, «Крупный вид готового» — 196 of poster with the play circle in the middle
          of it, the «Готов» badge and «2:30 · 16:9» along the bottom. The press is the whole card
          and it raises the one player this product has; a film whose link has not been read back
          yet takes no finger, rather than opening an empty window. */}
      <CardMontage
        large
        state="ready"
        title={title}
        meta={montage === null ? undefined : cutAs(montage)}
        poster={montage?.poster_url ?? undefined}
        badge={<BadgeMontage state="ready" label={s.montage.status.ready} />}
        label={s.montage.watch(title)}
        onPress={film === null ? undefined : () => setPlaying(true)}
      />

      {/* Neither of them touches the api: the video goes down the link the list carried, into the
          phone's own gallery or out through its own share sheet. Neither is anybody's alone
          either — whoever brought material gets the film back, a viewer included. */}
      <Shares>
        {/* Both at 44, which is what the layout draws them at and the floor spec 10.2 holds
            anything a finger lands on to. */}
        <Button
          variant="primary"
          size="sm"
          wide
          icon={Download}
          label={s.action.save}
          disabled={busy || film === null}
          onPress={() => film && void run(film, 'save')}
        />
        <Button
          size="sm"
          wide
          icon={Share}
          label={s.action.share}
          disabled={busy || film === null}
          onPress={() => film && void run(film, 'share')}
        />
      </Shares>

      {notice ? <Banner text={notice} /> : null}

      {/* «Как собирался». A montage cut before the journal existed answers with nothing at all
          (api README), and then this whole block is simply not here — not an error, and not a
          heading over an empty space. */}
      {journal.stages.length === 0 ? null : (
        <>
          <Text role="section" accessibilityRole="header" style={styles.head}>
            {s.montage.live.howMade}
          </Text>

          {/* Three numbers out of the stages' own outcomes (detail 44). A key the worker did not
              write leaves its tile out rather than standing a dash in it. */}
          {tiles.length === 0 ? null : (
            <Shares>
              {tiles.map((tile) => (
                <TileNumber key={tile.label} figure={String(tile.figure)} label={tile.label} />
              ))}
            </Shares>
          )}

          {/* All five, closed (`MontageLiveDone`): the journal of each is still there and still
              opens — a row is the way into its stage's journal, and a frame's card is there. */}
          <StageRows memoryId={id} montageId={montageId} journal={journal} />
        </>
      )}

      <FilmPlayer film={playing ? film : null} onClose={() => setPlaying(false)} />
    </Board>
  );
}

// Nothing here carries a colour of its own — every piece on this page brings the kit's with it.
const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    paddingHorizontal: space.s4,
    paddingTop: space.s3,
    paddingBottom: space.s6,
    // The layout stands everything on this screen 12 apart, and the two rows that hold several
    // things in one line — the buttons, the tiles — keep 8 inside themselves (`Shares`: equal
    // shares as drawn, one under another once a word in them breaks).
    gap: space.s3,
  },
  // The heading of the journal keeps the layout's own breath over it, and its left edge is the
  // two points the rest of the words on this screen start at.
  head: { paddingTop: 6, paddingHorizontal: 2 },
});
