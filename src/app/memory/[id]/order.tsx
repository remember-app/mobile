import { getDocumentAsync } from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Aperture,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Copy,
  Film,
  ImageOff,
  Info,
  Pause,
  Play,
  Plus,
  SunDim,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  ApiError,
  errorMessage,
  listMedia,
  orderMontage,
  type MediaItem,
  type MontageOrientation,
  type MusicTrackId,
} from '@/api';
import { useAuth } from '@/auth';
import { formatRuntime } from '@/dates';
import {
  ActionBar,
  Banner,
  Board,
  Button,
  Chip,
  GRID_GAP,
  Icon,
  ICO_S,
  IconButton,
  RowRejected,
  RowSummary,
  RowTrack,
  Segment,
  Sheet,
  Text,
  TextArea,
  Tile,
  Waiting,
  WizardBar,
  type IconComponent,
} from '@/kit';
import { useStrings } from '@/language';
import {
  afterTap,
  blankOrder,
  droppedByPass,
  enoughMaterial,
  LENGTHS,
  MIN_FRAMES,
  pickOf,
  reasonOf,
  rejectedGroups,
  STORY_LIMIT,
  taken,
  TRACKS,
  usable,
  wishes,
  type Length,
  type Order,
  type Reason,
} from '@/montage';
import { sendOwnTrack, useTrackPreview } from '@/music';
import { type Strings } from '@/strings';
import { radius, space, themed, useTheme } from '@/theme';

/**
 * Ordering a movie, in the four steps spec 8 lays out: which frames to take, what it is about, what
 * to cut it to, and how to put it together. One screen and not four — the wizard is one decision
 * with one way out, and nothing is sent until its last button.
 *
 * A route of its own rather than a sheet over the movies (which is what it was until TASK-162): four
 * steps do not fit on a sheet, and the back gesture belongs to the step and not to the memory.
 * Called `order` and not `montage` because a memory's movies are a face of the memory and never a
 * route — this is the asking for one.
 *
 * What comes of a finished order is not the list the organizer came from but the waiting over the
 * one montage they just asked for — `MontageProgress`, the screen spec 8 draws after this one
 * (TASK-163). The list is behind it either way, and it is still the list that has the finished video
 * on it: this wizard's last act is to hand the row the api answered with to that screen.
 */
export default function OrderMontageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const s = useStrings();
  const { color } = useTheme();
  const styles = useStyles();
  /**
   * One column of the grid on step 1, worked out rather than flexed — `memory/frames.tsx` says why
   * at length: a `1fr` column is the same width in a last row of one as in a full row of three, and
   * `flex: 1/3` is not. This grid stands inside the screen's own 16 margins.
   */
  const { width } = useWindowDimensions();
  const cell = { width: (width - space.s4 * 2 - GRID_GAP * 2) / 3 };

  /** null means «not read yet»: until it is, there is no step to draw and no count to draw it with. */
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [order, setOrder] = useState<Order>(blankOrder);
  /** Whether `SheetRejected` is up over step 1 — what the automatic pass dropped, and why. */
  const [showDropped, setShowDropped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * Whether this screen is still here. `router` is the app's own and not this screen's, so a call
   * that was in flight when somebody pressed «Отмена» — or took the back gesture — would otherwise
   * move the app under whoever is on top now, seconds after they left the wizard (found in review).
   * Reset on the way in as well as set on the way out, so a remount is a screen that is here again.
   */
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);

  /**
   * Read once, on the way in. Deliberately not on every focus the way the three faces of a memory
   * read themselves: an order is a decision taken about the material as it stands, and a re-read
   * landing between step 1 and step 4 would move the ground under a selection already made. The api
   * checks every named frame at the order anyway, which is the case this cannot get wrong.
   */
  useEffect(() => {
    if (!token) return;
    listMedia(token, id).then(setItems, (e: unknown) => setError(errorMessage(e)));
  }, [token, id]);

  const material = useMemo(() => usable(items ?? []), [items]);
  const inMovie = taken(material, order);
  const passDropped = droppedByPass(material, order);
  /** Too little to cut anything out of: the sheet below stands in place of the whole wizard. */
  const short = items !== null && !enoughMaterial(items);
  const change = (patch: Partial<Order>) => setOrder((was) => ({ ...was, ...patch }));

  /** Out of the wizard with nothing ordered — «Отмена», and the back button on the first step. */
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/memory/[id]', params: { id, face: 'films' } });
  };

  /**
   * «Свой трек с телефона»: picked, sent and held by the key R2 answers with. Sent the moment it is
   * picked rather than at the order, so that the last button of the wizard is one call and not two —
   * and a wizard abandoned after this leaves one small object in the bucket, which is the price of
   * not making somebody wait through an upload while the order is in flight.
   */
  async function pickOwnTrack() {
    if (!token) return;
    // Busy from the moment the phone's own picker is up: the wizard cannot move on to the length
    // while the track it is about to be cut to is still being chosen, let alone sent.
    setBusy(true);
    setNotice(null);
    try {
      const picked = await getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      const file = picked.assets?.[0];
      if (picked.canceled || !file) return;

      const key = await sendOwnTrack(token, id, { uri: file.uri, name: file.name });
      if (gone.current) return;
      // One or the other, never both: the api refuses a body carrying a shelf id and a key.
      change({ ownTrack: { key, name: file.name }, track: null });
    } catch (e) {
      if (!gone.current) setNotice(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** The one call the whole wizard leads to: everything the four steps settled, in one body. */
  async function submit() {
    if (!token || items === null) return;
    setBusy(true);
    setNotice(null);
    try {
      const made = await orderMontage(token, id, wishes(items, order));
      // Left while it was in flight: the order is placed and cannot be unsent, but the screen that
      // asked for it is not here to lead anywhere — the list on the memory is where it shows up.
      if (gone.current) return;
      // Onto the waiting for this one montage (TASK-163), and `replace` rather than `push`: the
      // order is sent, so the four steps behind this screen are not somewhere to go back to — what
      // is under the waiting is the memory it was ordered from. The count of frames goes along
      // because the wizard is the only one who ever counts them; the api hands back what it wrote
      // and not how many pictures it adds up to.
      router.replace({
        pathname: '/memory/[id]/montage/[montageId]',
        params: { id, montageId: made.id, frames: inMovie.length },
      });
    } catch (e) {
      if (gone.current) return;
      // The material can still fall under the floor between the read above and this call — somebody
      // else deleting what this order was counting on. The api's own line names its numbers; these
      // name what to do about them.
      setNotice(
        e instanceof ApiError && e.status === 409
          ? s.montage.tooLittle
          : e instanceof ApiError && e.status === 403
            ? s.montage.orderDenied
            : errorMessage(e),
      );
      setBusy(false);
    }
  }

  const last = step === STEPS;
  const bottomLabel = last
    ? s.montage.makeIt
    : step === 1
      ? s.montage.nextWith(inMovie.length)
      : s.montage.next;

  return (
    <Board>
      <WizardBar
        step={step}
        steps={STEPS}
        label={s.montage.step(step, STEPS)}
        back={
          <IconButton
            icon={ChevronLeft}
            label={s.action.back}
            style={styles.back}
            onPress={() => (step === 1 ? leave() : setStep(step - 1))}
          />
        }
        cancel={<Button variant="quiet" label={s.action.cancel} onPress={leave} />}
      />

      {error !== null ? (
        <Banner tone="error" text={error} style={styles.banner} />
      ) : items === null ? (
        <View style={styles.middle}>
          <Waiting text={s.state.loading} />
        </View>
      ) : short ? null : step === 1 ? (
        <PickStep
          s={s}
          material={material}
          order={order}
          cell={cell}
          inMovie={inMovie.length}
          byPass={passDropped.length}
          onTap={(item) => change(afterTap(item, order))}
          onShowDropped={() => setShowDropped(true)}
        />
      ) : step === 2 ? (
        <StoryStep s={s} story={order.story} onStory={(story) => change({ story })} />
      ) : step === 3 ? (
        <MusicStep
          s={s}
          token={token}
          order={order}
          busy={busy}
          onTrack={(track) => change({ track, ownTrack: null })}
          onOwnTrack={() => void pickOwnTrack()}
          onNotice={setNotice}
        />
      ) : (
        <BuildStep
          s={s}
          order={order}
          inMovie={inMovie.length}
          all={material.length}
          onSeconds={(seconds) => change({ seconds })}
          onOrientation={(orientation) => change({ orientation })}
          onStep={setStep}
        />
      )}

      {/* Above the bar and outside the body, the way every face of a memory holds its own: what the
          button below answers with must not land at the bottom of something that has scrolled. */}
      {notice ? <Banner text={notice} style={styles.banner} /> : null}

      {items === null || short ? null : (
        <ActionBar>
          <Button
            variant="primary"
            wide
            icon={last ? Film : undefined}
            trailingIcon={last ? undefined : ChevronRight}
            label={bottomLabel}
            busy={busy}
            busyLabel={last ? undefined : s.montage.sendingTrack}
            // Under three taken is nothing to cut: the one step that can put the order below the
            // floor is the first, and it says so by going dark rather than by refusing the press
            // silently. Held here because nothing behind this screen holds it — the api counts the
            // ready material for its 409 and never the selection, and so does the worker, so an
            // order taking one frame out of twenty is accepted and cut into a one-frame «ролик»
            // against a minute that was asked for (found in review).
            disabled={step === 1 && inMovie.length < MIN_FRAMES}
            onPress={last ? () => void submit() : () => setStep(step + 1)}
          />
        </ActionBar>
      )}

      <Sheet
        visible={showDropped}
        onCancel={() => setShowDropped(false)}
        title={s.montage.droppedTitle}
        scroll
        footer={
          <>
            <Button
              variant="primary"
              label={s.montage.bringBackAll(passDropped.length)}
              // Added to what has already been taken back, never in place of it: «все» means the
              // ones still out, and replacing the set would quietly drop the earlier ones again.
              onPress={() => {
                change({
                  returned: new Set([...order.returned, ...passDropped.map((item) => item.id)]),
                });
                setShowDropped(false);
              }}
            />
            <Button
              variant="quiet"
              wide
              label={s.montage.leaveAsIs}
              onPress={() => setShowDropped(false)}
            />
          </>
        }
      >
        <Text role="body" tone="muted">
          {s.montage.droppedText(passDropped.length, material.length)}
        </Text>
        {rejectedGroups(material, order).map((group, i) => (
          <RowRejected
            key={group.reason}
            icon={REASON_SIGN[group.reason]}
            title={s.montage.reason[group.reason]}
            count={
              group.reason === 'duplicate'
                ? `${s.memory.frames(group.ids.length)} — ${s.montage.keptBest}`
                : s.memory.frames(group.ids.length)
            }
            divider={i > 0}
          >
            <Button
              size="xs"
              label={s.montage.bringBack}
              onPress={() => change({ returned: new Set([...order.returned, ...group.ids]) })}
            />
          </RowRejected>
        ))}
      </Sheet>

      {/* Spec 8: raised in place of step 1, because an order that cannot go through is not a wizard
          to walk. Cancelling it — the handle, the darkness, «Позже» — leaves the whole screen. */}
      <Sheet
        visible={short}
        onCancel={leave}
        narrow
        // The sign and the heading stand on one line here, which is why the heading is drawn inside
        // the head row rather than handed over as `title` — the sheet stacks those two.
        head={
          <View style={styles.headLine}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.sign}
            >
              <Icon icon={Film} size={26} color={color.muted} />
            </View>
            <Text role="sheetTitleSm" accessibilityRole="header" style={styles.grow}>
              {s.montage.tooLittleTitle}
            </Text>
          </View>
        }
        footer={
          <>
            <Button
              variant="primary"
              icon={Plus}
              label={s.gallery.add}
              onPress={() => router.replace({ pathname: '/memory/[id]/upload', params: { id } })}
            />
            <Button variant="quiet" wide label={s.montage.later} onPress={leave} />
          </>
        }
      >
        <Text role="bodySm" tone="muted">
          {s.montage.tooLittleText(material.length)}
        </Text>
      </Sheet>
    </Board>
  );
}

/** Four of them, and the scale under the bar counts the same four. */
const STEPS = 4;

/** The glyph each reason of the automatic pass wears, on the tile and in the sheet (spec 7.4). */
const REASON_SIGN: Record<Reason, IconComponent> = {
  blur: Aperture,
  duplicate: Copy,
  exposure: SunDim,
  unreadable: ImageOff,
  other: CircleSlash,
};

/**
 * Step 1, `MontageSelect` — the automatic pass reports and the organizer rules. Every tile is one
 * of four things: going in, dropped by the pass with the reason on it, dropped by hand, or a video
 * with its running time; and a tap moves any of them to the other side.
 */
function PickStep({
  s,
  material,
  order,
  cell,
  inMovie,
  byPass,
  onTap,
  onShowDropped,
}: {
  s: Strings;
  material: readonly MediaItem[];
  order: Order;
  cell: { width: number };
  /** How many are going in, and how many the pass has dropped and nobody has taken back. */
  inMovie: number;
  byPass: number;
  onTap: (item: MediaItem) => void;
  onShowDropped: () => void;
}) {
  const styles = useStyles();
  // Three to a row by hand rather than `numColumns`, the way both galleries cut theirs.
  const rows = useMemo(
    () =>
      Array.from({ length: Math.ceil(material.length / 3) }, (_, i) =>
        material.slice(i * 3, i * 3 + 3),
      ),
    [material],
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row[0]?.id ?? ''}
      contentContainerStyle={styles.grid}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text role="display" accessibilityRole="header">
            {s.montage.pickTitle}
          </Text>
          {/* The count and the way into what the pass dropped, on one line: the pass reports here
              and explains itself there. No button while it has dropped nothing. */}
          <View style={styles.headLine}>
            <Text role="label" tone="muted" style={styles.grow}>
              {byPass > 0
                ? `${s.montage.pickMeta(inMovie, material.length)} · ${s.montage.passDropped(byPass)}`
                : s.montage.pickMeta(inMovie, material.length)}
            </Text>
            {byPass > 0 ? (
              <Button size="sm" label={s.montage.whatDropped} onPress={onShowDropped} />
            ) : null}
          </View>
        </View>
      }
      renderItem={({ item: row }) => (
        <View style={styles.row}>
          {row.map((item) => {
            const pick = pickOf(item, order);
            const reason = reasonOf(item.screening_reason);

            return (
              <Tile
                key={item.id}
                state="ready"
                uri={item.thumbnail_url ?? undefined}
                pick={pick}
                length={item.kind === 'video' ? formatRuntime(item.duration_seconds) : undefined}
                reason={
                  pick === 'auto'
                    ? { icon: REASON_SIGN[reason], label: s.montage.reason[reason] }
                    : undefined
                }
                label={pick === 'keep' ? s.montage.inMovie : s.montage.outOfMovie}
                onPress={() => onTap(item)}
                style={cell}
              />
            );
          })}
        </View>
      )}
    />
  );
}

/**
 * Step 2, `MontageStory` — what the video is about, in the organizer's own words, and nothing here
 * is required: left empty, the director decides. The four openers under the box are a way to start
 * the sentence, not answers to pick between.
 */
function StoryStep({
  s,
  story,
  onStory,
}: {
  s: Strings;
  story: string;
  onStory: (story: string) => void;
}) {
  const styles = useStyles();

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.head}>
        <Text role="display" accessibilityRole="header">
          {s.montage.storyTitle}
        </Text>
        <Text role="bodySm" tone="muted">
          {s.montage.storyHint}
        </Text>
      </View>

      {/* The screen's own heading is this box's label, so the label itself is only spoken. */}
      <TextArea
        label={s.montage.storyLabel}
        labelHidden
        hint={s.montage.storyNote}
        limit={STORY_LIMIT}
        placeholder={s.montage.storyPlaceholder}
        value={story}
        onChangeText={onStory}
      />

      <View style={styles.seeds}>
        {s.montage.seeds.map((seed) => (
          <Chip
            key={seed}
            label={seed}
            // Put where the sentence is, not in place of it: a seed lands at the end of what is
            // already written, and the box keeps whatever was there. Cut to the limit the box
            // itself holds typing to — a seed must not be the one way past it.
            onPress={() =>
              onStory((story ? `${story.trimEnd()} ${seed} ` : `${seed} `).slice(0, STORY_LIMIT))
            }
          />
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * Step 3, `MontageMusic` — the shelf of five, or one off this phone. Picking one is picking one:
 * their own track takes the choice off the shelf and choosing off the shelf drops their own, because
 * the api takes exactly one answer to «под что монтировать».
 *
 * Listening is not picking: the round button on the left plays the track where it stands and leaves
 * the choice alone, so the shelf can be heard through without anything being decided. The player is
 * this component's own — this step going away is the music stopping, whether that is the step after
 * it or the wizard closing (TASK-172).
 */
function MusicStep({
  s,
  token,
  order,
  busy,
  onTrack,
  onOwnTrack,
  onNotice,
}: {
  s: Strings;
  /** For «Послушать» alone: the link to each track is signed per press. */
  token: string | null;
  order: Order;
  busy: boolean;
  onTrack: (track: MusicTrackId) => void;
  onOwnTrack: () => void;
  /** A link that would not sign is said in the wizard's own banner, over the bottom bar. */
  onNotice: (line: string | null) => void;
}) {
  const styles = useStyles();
  const { playing, toggle } = useTrackPreview(token);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.head}>
        <Text role="display" accessibilityRole="header">
          {s.montage.musicTitle}
        </Text>
        <Text role="bodySm" tone="muted">
          {s.montage.musicHint}
        </Text>
      </View>

      <View>
        {TRACKS.map((track, i) => {
          const name = s.montage.track[track.id];
          /** How far into this one, or null while it is not the one sounding. */
          const heard = playing?.track === track.id ? playing.at : null;
          const picked = order.track === track.id;

          return (
            <RowTrack
              key={track.id}
              title={name}
              length={track.length}
              playing={heard !== null}
              divider={i > 0}
              play={
                <IconButton
                  icon={heard !== null ? Pause : Play}
                  label={heard !== null ? s.montage.stopTrack(name) : s.montage.listen(name)}
                  size={40}
                  tone="surface"
                  onPress={() => {
                    onNotice(null);
                    void toggle(track.id).catch((e: unknown) => onNotice(errorMessage(e)));
                  }}
                />
              }
              // Spec 7.7 — the row no longer picks; the 36 on its right does, and it says which
              // way it is: the plus takes the track, the tick gives it back.
              action={
                <IconButton
                  icon={picked ? Check : Plus}
                  label={picked ? s.montage.stopTrack(name) : name}
                  size={36}
                  tone={picked ? 'surface' : 'ghost'}
                  on={picked}
                  style={picked ? undefined : styles.listen}
                  onPress={() => onTrack(track.id)}
                />
              }
            />
          );
        })}
        {/* Their own, once it is up: the same row, under the name the file carries on the phone —
            which is a person's own word and stays as it is. */}
        {order.ownTrack ? (
          <RowTrack title={order.ownTrack.name} length={s.montage.ownTrackShort} wave divider />
        ) : null}
      </View>

      {/* Spec 7.6: the one dashed button in the product, and it is the kit's outlined button wearing
          the dashed border and the 18 radius that entry asks for. */}
      <Button
        icon={Plus}
        label={s.montage.ownTrack}
        disabled={busy}
        style={styles.dashed}
        onPress={onOwnTrack}
      />
    </ScrollView>
  );
}

/**
 * Step 4, `MontageBuild` — the shape of the thing, what the three steps before came to, and the one
 * warning. The summary is a way back and not a receipt: every line leads to the step that settled
 * it. The warning stands before the button, never after it.
 */
function BuildStep({
  s,
  order,
  inMovie,
  all,
  onSeconds,
  onOrientation,
  onStep,
}: {
  s: Strings;
  order: Order;
  /** What step 1 came to, against everything the memory holds. */
  inMovie: number;
  all: number;
  onSeconds: (seconds: Length) => void;
  onOrientation: (orientation: MontageOrientation) => void;
  onStep: (step: number) => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const story = order.story.trim();
  const music = order.ownTrack
    ? s.montage.ownTrackShort
    : order.track
      ? `${s.montage.track[order.track]} · ${s.montage.onTheBeat}`
      : s.montage.directorDecides;

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.head}>
        <Text role="display" accessibilityRole="header">
          {s.montage.buildTitle}
        </Text>
      </View>

      <Segment
        label={s.montage.howLong}
        wide
        options={LENGTHS.map((seconds) => ({
          value: String(seconds) as `${Length}`,
          label: s.montage.length[seconds],
        }))}
        value={String(order.seconds) as `${Length}`}
        onChange={(picked) => onSeconds(Number(picked) as Length)}
      />

      <Segment
        label={s.montage.shape}
        wide
        options={ORIENTATIONS.map((way) => ({ value: way, label: s.montage.orientation[way] }))}
        value={order.orientation}
        onChange={onOrientation}
      />

      <View style={styles.summary}>
        <RowSummary
          label={s.memory.framesPlain}
          value={s.montage.framesOf(inMovie, all)}
          onPress={() => onStep(1)}
        />
        <RowSummary
          label={s.montage.story}
          value={story || s.montage.nothingSaid}
          onPress={() => onStep(2)}
          divider
        />
        <RowSummary label={s.montage.music} value={music} onPress={() => onStep(3)} divider />
      </View>

      <View style={styles.warn}>
        <Icon icon={Info} size={ICO_S} color={color.faint} />
        <Text role="meta" tone="faint" style={styles.grow}>
          {s.montage.onceOnly}
        </Text>
      </View>
    </ScrollView>
  );
}

/** Both ways up, in the order the layout draws them. */
const ORIENTATIONS: readonly MontageOrientation[] = ['landscape', 'portrait'];

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    // Spec 7.1: the wizard's back button hangs 10 past the screen's margin, as every «Назад» does.
    back: { marginLeft: -10 },
    banner: { marginHorizontal: space.s4, marginBottom: space.s3 },
    middle: { flex: 1, justifyContent: 'center' },
    // The head of every step: the screen's own name, and the line under it that says what to do.
    head: { gap: space.s2, paddingTop: space.s5, paddingBottom: space.s4 },
    headLine: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    body: { flexGrow: 1, paddingHorizontal: space.s4, paddingBottom: space.s6, gap: space.s5 },
    grid: { paddingHorizontal: space.s4, paddingBottom: space.s7, gap: GRID_GAP },
    row: { flexDirection: 'row', gap: GRID_GAP },
    seeds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
    // Spec 7.6, «свой трек с телефона»: a dashed `handle` border at the field's own radius.
    dashed: { borderStyle: 'dashed', borderColor: color.handle, borderRadius: radius.field },
    // «Послушать» on a row nobody picked: the outlined one, drawn in the louder of the two borders.
    listen: { borderColor: color.lineStrong },
    summary: {
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.section,
      backgroundColor: color.surface,
      paddingVertical: space.s1,
    },
    warn: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3, paddingHorizontal: space.s1 },
    // Spec 8, `SheetTooLittle`: the 56 square with the montage sign over the heading.
    sign: {
      width: 56,
      height: 56,
      borderRadius: radius.cell,
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
