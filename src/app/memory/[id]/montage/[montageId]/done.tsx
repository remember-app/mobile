import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Download, Share } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  type JournalFile,
  listMembers,
  listMontages,
  type Member,
  type Montage,
  memberName,
} from '@/api';
import {
  AppBar,
  BadgeMontage,
  Banner,
  Board,
  Button,
  CardMontage,
  IconButton,
  Text,
  TileNumber,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatRuntime } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import { howMade, madeInMinutes, useMontageJournal } from '@/lib/montage/journal';
import { RATIO } from '@/lib/montage/order';
import { FilmPlayer, montageTitle, useFilmActions } from '@/screens/memory/film-player';
import { SheetLiveFile } from '@/screens/memory/live-file';
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
   * All five stages are opened out here, so each of them brings its own last records along, however
   * far behind the newest page they lie.
   */
  const journal = useMontageJournal(token, id, montageId, { everyStage: true });

  const [montage, setMontage] = useState<Montage | null>(null);
  const [roster, setRoster] = useState<Member[] | null>(null);
  /** Whether the film is being watched — the player is the one in `film-player`, and it is a window. */
  const [playing, setPlaying] = useState(false);
  /** The record whose file card is open, held by id the way the stage journal holds it. */
  const [opened, setOpened] = useState<number | null>(null);

  /** Keeping the film and handing it on — the two buttons under the poster, one busy line for both. */
  const { busy, notice, run } = useFilmActions();

  /**
   * What the journal does not carry: what was ordered and how long it came out, and the names of
   * everybody in the memory — the journal names an author by id. On focus and not on
   * mount, like every other screen of a memory: `video_url` is signed for a quarter of an hour, so
   * coming back to this page an hour later re-reads the link it is watched and saved through.
   */
  const read = useCallback(() => {
    if (!token) return;
    listMontages(token, id).then(
      (list) => setMontage(list.find((one) => one.id === montageId) ?? null),
      () => {},
    );
    listMembers(token, id).then(setRoster, () => {});
  }, [token, id, montageId]);

  // And the player is shut on the way out: a `router.push` off a tapped push leaves this screen
  // mounted behind it, and a playing film would otherwise stand over whatever came next (TASK-94).
  useFocusEffect(
    useCallback(() => {
      read();
      return () => setPlaying(false);
    }, [read]),
  );

  const whose = useCallback(
    (file: JournalFile | undefined) =>
      memberName(roster?.find((one) => one.id === file?.uploaded_by) ?? null),
    [roster],
  );

  const title = montage === null ? '' : montageTitle(montage, s);
  const made = madeInMinutes(journal.stages);
  const tiles = howMade(journal.stages, s);
  const card = journal.entries.find((entry) => entry.id === opened);
  const cardFile = card?.media_id ? journal.files[card.media_id] : undefined;
  /** The film once there is a link to it — what «смотреть», «Сохранить» and «Поделиться» all need. */
  const film = montage?.video_url ? montage : null;

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
          left={
            <IconButton
              icon={ChevronLeft}
              label={s.action.back}
              // The strip of films is under this page both ways in; a montage that landed here by a
              // `replace` off the live screen has the memory itself under it.
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace({ pathname: '/memory/[id]', params: { id } })
              }
            />
          }
        />
      }
      body={styles.body}
    >
      {/* Spec detail 38, «Крупный вид готового» — 196 of poster with the play circle in the middle
          of it, the «Готов» badge and «2:30 · 16:9» along the bottom. The press is the whole card
          and it raises the one player this product has; a film whose link has not been read back
          yet takes no finger, rather than opening an empty window. */}
      <CardMontage
        large
        state="ready"
        title={title}
        meta={madeTo(montage)}
        poster={montage?.poster_url ?? undefined}
        badge={<BadgeMontage state="ready" label={s.montage.status.ready} />}
        label={s.montage.watch(title)}
        onPress={film === null ? undefined : () => setPlaying(true)}
      />

      {/* Neither of them touches the api: the video goes down the link the list carried, into the
          phone's own gallery or out through its own share sheet. Neither is anybody's alone
          either — whoever brought material gets the film back, a viewer included. */}
      <View style={styles.actions}>
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
          style={styles.grow}
        />
        <Button
          size="sm"
          wide
          icon={Share}
          label={s.action.share}
          disabled={busy || film === null}
          onPress={() => film && void run(film, 'share')}
          style={styles.grow}
        />
      </View>

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
            <View style={styles.tiles}>
              {tiles.map((tile) => (
                <TileNumber key={tile.label} figure={String(tile.figure)} label={tile.label} />
              ))}
            </View>
          )}

          {/* All five, the way the live screen draws them — the journal of each is still there and
              still opens, and a record with a frame on it opens that frame's card. */}
          <StageRows
            memoryId={id}
            montageId={montageId}
            journal={journal}
            opens={() => true}
            onRecord={(entry) => setOpened(entry.id)}
          />
        </>
      )}

      <FilmPlayer film={playing ? film : null} onClose={() => setPlaying(false)} />

      {card ? (
        <SheetLiveFile
          entry={card}
          file={cardFile}
          author={whose(cardFile)}
          onCancel={() => setOpened(null)}
        />
      ) : null}
    </Board>
  );
}

/**
 * «2:30 · 16:9» along the bottom of the poster: what the film actually came out as. The running time
 * is the worker's own and the shape is what was ordered — the api reads a montage with no
 * orientation on it as horizontal, which is what every montage was before the choice existed.
 */
function madeTo(montage: Montage | null): string | undefined {
  if (montage === null) return undefined;
  const runtime = formatRuntime(montage.duration_seconds);
  return [runtime, RATIO[montage.params.orientation ?? 'landscape']].filter(Boolean).join(' · ');
}

// Nothing here carries a colour of its own — every piece on this page brings the kit's with it.
const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    paddingHorizontal: space.s4,
    paddingTop: space.s3,
    paddingBottom: space.s6,
    // The layout stands everything on this screen 12 apart, and the two rows that hold several
    // things in one line — the buttons, the tiles — keep 8 inside themselves.
    gap: space.s3,
  },
  // The two buttons stand in one row of equal halves, as the layout draws them.
  actions: { flexDirection: 'row', gap: space.s2 },
  grow: { flex: 1, minWidth: 0 },
  // The heading of the journal keeps the layout's own breath over it, and its left edge is the
  // two points the rest of the words on this screen start at.
  head: { paddingTop: 6, paddingHorizontal: 2 },
  tiles: { flexDirection: 'row', gap: space.s2 },
});
