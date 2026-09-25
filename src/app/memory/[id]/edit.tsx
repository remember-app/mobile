import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ApiError,
  errorMessage,
  listMedia,
  listMemories,
  type MediaItem,
  type Memory,
  updateMemory,
} from '@/api';
import {
  ActionBar,
  AppBar,
  BackButton,
  Banner,
  Board,
  Button,
  ConfirmSheet,
  CoverSlot,
  Field,
  Hint,
  Text,
  Waiting,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { endOfDay, formatDay, startOfDay } from '@/lib/dates';
import { mayPick, shotAt } from '@/lib/frames';
import { useStrings } from '@/lib/language';
import { CoverSheet } from '@/screens/memory/cover';
import { EventWhen, type Span } from '@/screens/memory/when';
import { board, height, radius, space, themed } from '@/theme';

/**
 * `MemoryEdit` (spec 10.8.3) — the name, the days and the cover of a memory, changed in one go. A
 * screen and not a sheet: the calendar does not fit on one, and three things are edited at once.
 *
 * Only the organizer ever arrives here — the settings screen draws the pencil for nobody else — and
 * the api refuses anybody else with a 403 either way. There is no deleting a memory here and there
 * will not be: in MVP a memory cannot be deleted at all (doc-01).
 *
 * Nothing is applied until «Сохранить»: a cover chosen on the sheet lives in the slot on this screen
 * and not in the memory, and walking away with edits nobody saved asks first — gently, because
 * nothing is lost by walking away.
 */
export default function MemoryEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const [memory, setMemory] = useState<Memory | null>(null);
  // The gallery, for the sheet that picks a cover out of it and for the day the chosen frame was
  // shot on. Its failure is not this screen's failure: the name and the days are still editable, and
  // the cover block then simply has nothing to offer.
  const [media, setMedia] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [span, setSpan] = useState<Span | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Read once and not on every focus, unlike every list in the app: what is on this screen is what
  // somebody is in the middle of typing, and a refetch under their hands would take it away.
  useEffect(() => {
    if (!token) return;
    listMemories(token).then(
      (list) => {
        const one = list.find((each) => each.id === id) ?? null;
        setMemory(one);
        // Not on the list is not «still loading»: the listing answered, and this person is not in the
        // memory any more (or never was). Left as it was, the screen waited on it for ever.
        if (one === null) return setError(errorMessage(new ApiError(404, null)));
        setTitle(one.title);
        setSpan(spanOf(one));
        setCover(one.cover_media_id);
      },
      (e: unknown) => setError(errorMessage(e)),
    );
    listMedia(token, id).then(setMedia, () => {});
  }, [token, id]);

  const ready = memory !== null && title !== null && span !== null;
  // What the sheet would offer: a memory whose frames are all still developing has none to promote,
  // and neither has one with nothing in it at all.
  const pickable = (media ?? []).filter(mayPick);
  const chosen = cover === null ? null : ((media ?? []).find((item) => item.id === cover) ?? null);
  // The chosen frame's own picture, and — until the gallery answers — the one the listing signed for
  // the cover that is already set, so the slot is never empty on a memory that has one.
  const coverUri =
    chosen?.thumbnail_url ??
    (cover !== null && cover === memory?.cover_media_id ? memory.cover_thumbnail_url : null);
  const named = title?.trim() ?? '';
  const changed =
    ready &&
    (named !== memory.title || cover !== memory.cover_media_id || !sameSpan(span, spanOf(memory)));

  /** «Назад» with edits nobody saved asks first; with none it simply goes. */
  const leave = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/memory/[id]/settings', params: { id } });

  async function save() {
    if (!token || !ready || !changed || named === '') return;
    setSaving(true);
    setFailed(null);
    try {
      // Only what was touched goes up: the api refuses an empty body on purpose, and sending every
      // field on every save would write the days back over a change somebody else just made.
      await updateMemory(token, id, {
        ...(named === memory.title ? {} : { title: named }),
        ...(sameSpan(span, spanOf(memory))
          ? {}
          : {
              event_start: startOfDay(span.from).toISOString(),
              event_end: span.to === null ? null : endOfDay(span.to).toISOString(),
            }),
        ...(cover === memory.cover_media_id ? {} : { cover_media_id: cover }),
      });
      leave();
    } catch {
      // The api's own wording is written for whoever runs it; what a person can do about a save that
      // did not land is the same whatever went wrong, so the screen says that instead.
      setFailed(s.edit.failed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Board
      bar={
        <AppBar
          // Paired with «Новое воспоминание» on `Create`, and deliberately not «Воспоминание»
          // again.
          title={s.edit.title}
          left={
            <BackButton
              label={s.action.back}
              // Live while the save is in flight (spec 10.8.3) — the only control on the screen
              // that is.
              onPress={() => (changed ? setLeaving(true) : leave())}
            />
          }
        />
      }
      footer={
        <ActionBar>
          <Button
            variant="primary"
            wide
            label={s.edit.save}
            // Spec 10.8.3 names this one exactly: the spinner takes the place of the glyph and the
            // word does not change — there is no continuous form of «Сохранить» on this button.
            busy={saving}
            // Nothing changed is nothing to press, and the screen says so by being unavailable
            // rather than by a line explaining itself (spec 10.8.3).
            disabled={!changed || named === ''}
            onPress={() => void save()}
          />
        </ActionBar>
      }
      body={styles.body}
    >
      {failed !== null ? <Banner tone="error" text={failed} /> : null}

      {error !== null ? (
        <Banner tone="error" text={error} />
      ) : !ready ? (
        <View style={styles.middle}>
          <Waiting text={s.state.loading} />
        </View>
      ) : (
        <>
          <View style={styles.block}>
            <Text role="eyebrow" tone="muted" accessibilityRole="header">
              {s.create.titleLabel.toUpperCase()}
            </Text>
            <Field
              label={s.create.titleLabel}
              labelHidden
              variant="name"
              value={title}
              onChangeText={setTitle}
              placeholder={s.create.titlePlaceholder}
              editable={!saving}
              // Spec 10.8.3: an emptied name is a field error, and «Сохранить» goes with it.
              state={named === '' ? 'error' : undefined}
              hint={named === '' ? s.edit.noTitle : undefined}
            />
          </View>

          <EventWhen value={span} onChange={setSpan} disabled={saving} />

          <View style={styles.block}>
            <Text role="eyebrow" tone="muted" accessibilityRole="header">
              {s.edit.cover.toUpperCase()}
            </Text>
            <View style={styles.card}>
              <CoverSlot uri={coverUri} thumbs={memory.recent_thumbnail_urls} />
              <View style={styles.grow}>
                <Text role="row">
                  {cover === null
                    ? s.edit.coverNone
                    : chosen
                      ? s.edit.coverFrom(formatDay(new Date(shotAt(chosen))))
                      : s.edit.coverChosen}
                </Text>
                <Text role="meta">{cover === null ? s.edit.coverInstead : s.edit.coverWhere}</Text>
              </View>
              <Button
                variant="small"
                size="xs"
                label={cover === null ? s.edit.coverPick : s.edit.coverReplace}
                disabled={saving || pickable.length === 0}
                onPress={() => setPicking(true)}
              />
            </View>
            {/* Quiet and under the card, because putting a cover back costs nothing — there is
                nothing here to confirm. */}
            {cover === null ? null : (
              <Button
                variant="quiet"
                label={s.edit.coverDrop}
                disabled={saving}
                style={styles.quiet}
                onPress={() => setCover(null)}
              />
            )}
            {/* Only once the gallery has answered: while it is still on its way, and when it could
                not be read at all, «сначала нужен хотя бы один кадр» would be a statement about a
                memory nobody has looked into. */}
            {media !== null && pickable.length === 0 ? (
              <Hint>{s.edit.coverNeedsFrames}</Hint>
            ) : null}
          </View>
        </>
      )}

      <CoverSheet
        visible={picking}
        onCancel={() => setPicking(false)}
        media={media ?? []}
        chosen={cover}
        onChoose={(mediaId) => {
          setCover(mediaId);
          setPicking(false);
        }}
      />

      {/* Spec 7.1, detail 8 — the kind asked when nothing is lost: no thumbnail, no red, and the way
          on is the paper button. Walking away costs the edits and says exactly that. */}
      <ConfirmSheet
        visible={leaving}
        variant="gentle"
        title={s.edit.leaveAsk}
        text={s.edit.leaveText}
        confirmLabel={s.edit.leaveDo}
        cancelLabel={s.edit.stay}
        onConfirm={() => {
          setLeaving(false);
          leave();
        }}
        onCancel={() => setLeaving(false)}
      />
    </Board>
  );
}

/** The days a memory stands on, read as the calendar holds them: whole local days, end optional. */
function spanOf(memory: Memory): Span {
  const from = startOfDay(new Date(memory.event_start));
  const to = memory.event_end === null ? null : startOfDay(new Date(memory.event_end));
  // An end on the day it began is one day and not a span — the same reading `formatEventDates` gives
  // the line under the title, so the two never disagree about how long the event was.
  return { from, to: to !== null && to > from ? to : null };
}

/** Two spans are the same span when they cover the same days — never by the objects holding them. */
const sameSpan = (a: Span, b: Span) =>
  startOfDay(a.from).getTime() === startOfDay(b.from).getTime() &&
  (a.to === null ? null : startOfDay(a.to).getTime()) ===
    (b.to === null ? null : startOfDay(b.to).getTime());

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Spec 10.8.3: the rhythm of `Create` — the screen's own 16 at the sides, 22 between the blocks —
    // from 112, as the settings it is opened from start (spec 4; 10.11, answer 5).
    body: {
      flexGrow: 1,
      paddingTop: board.bodySettings - board.status - height.bar,
      paddingHorizontal: space.s4,
      paddingBottom: space.s6,
      gap: 22,
    },
    middle: { flexGrow: 1, justifyContent: 'center' },
    block: { gap: 9 },
    // «Выбрать» moves under the words when the system type leaves it no room beside them.
    card: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.s3,
      padding: space.s3,
      borderRadius: radius.card,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
    },
    // The words keep at least half the card: «Выбрать» goes under them rather than squeeze them to
    // a letter a line, and they wrap rather than being cut (TASK-377).
    grow: { flex: 1, minWidth: '50%' },
    quiet: { alignSelf: 'flex-start' },
  }),
);
