import { Image } from 'expo-image';
import { CalendarDays, Lock, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { type FrameInfo, type Label, memberName } from '@/api';
import {
  Avatar,
  Banner,
  Button,
  Calendar,
  Chip,
  DayTile,
  FaceRow,
  IconButton,
  RowFilmAt,
  RowSummary,
  Segment,
  Sheet,
  Spinner,
  Text,
} from '@/kit';
import {
  formatDay,
  formatDayShort,
  formatMonth,
  formatRuntime,
  formatWeekday,
  startOfDay,
  weekdayLetters,
} from '@/lib/dates';
import {
  dayTiles,
  FILTER_NONE,
  type Filter,
  type FilterDay,
  filtering,
  frameFacts,
  type GroupBy,
  type Order,
  type Sort,
} from '@/lib/frames';
import { usePlaceName } from '@/lib/geocoder';
import { labelTint } from '@/lib/labels';
import { useStrings } from '@/lib/language';
import { height, radius, space, themed, useTheme } from '@/theme';

/**
 * The sheets the gallery raises (spec 8): the two it is tuned from — the left round button at the
 * foot of the screen opens the one that decides **what** is shown, the right one the sheet that
 * decides **in what order** — and the one the open frame raises, «сведения о кадре». Their own
 * file rather than the faces': they are a second surface over a face, and both faces are long
 * enough already.
 *
 * None of them holds any material — the gallery is the face's, the frame is the viewer's, and each
 * sheet is handed what it has to offer and hands back the answer.
 */

/** One heading over a group of controls, in the caps the layout writes them in. */
function GroupLabel({ children }: { children: string }) {
  return (
    <Text role="eyebrow" tone="muted" accessibilityRole="header">
      {children.toUpperCase()}
    </Text>
  );
}

/** A choice pressed on or off again, without disturbing the set it came from. */
function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

/**
 * `SheetFilter` — what of the gallery to show (spec 8). Four groups: who brought it, what it is,
 * which boxes it lies in (spec 10.8.2), which day it is from. It scrolls inside itself once the
 * labels, a second row of faces or the calendar make it longer than the screen.
 *
 * «Сбросить» stands small beside the heading rather than under the main button: it is needed rarely
 * and must not argue with the one glowing thing on the sheet.
 *
 * The choices are a draft until the glowing button is pressed: it carries the number of frames they
 * would leave on screen, worked out on the spot, so nobody applies a filter without being told first
 * what it comes to — nothing chosen is «Показать все», and a choice that comes to nothing cannot be
 * applied at all («Ни одного кадра под эти условия»). Closing the sheet any other way leaves the
 * gallery exactly as it was.
 */
export function FilterSheet({
  people,
  labels,
  days,
  value,
  count,
  onApply,
  onCancel,
}: {
  /** Everybody who actually brought something, by the name the roster writes. */
  people: readonly { id: string; name: string }[];
  /**
   * Every label of this memory the person is allowed to see, in the api's own order — shared first,
   * by title within. Somebody else's private box is not among them: the server never sends it.
   */
  labels: readonly Label[];
  /** Every day the gallery holds, each with what it holds; the sheet picks which get a tile. */
  days: readonly FilterDay[];
  value: Filter;
  /** How many frames a draft would leave — the face owns the material, this only asks it. */
  count: (draft: Filter) => number;
  onApply: (filter: Filter) => void;
  onCancel: () => void;
}) {
  const s = useStrings();
  const styles = useStyles();
  // The label's colour is the one place on this sheet where a token is looked up by hand: the api
  // keeps the palette cell, 1–8, and the paint for it is the theme's (`labelTint`).
  const theme = useTheme();
  // Seeded once, because this sheet is mounted by being opened: what was applied is what it opens on.
  const [draft, setDraft] = useState<Filter>(value);
  const shown = count(draft);
  const chosen = filtering(draft);
  // A memory cannot be of tomorrow, so the calendar answers nothing past today — as on `Create`.
  const today = useMemo(() => new Date(), []);
  const tiles = useMemo(() => dayTiles(days), [days]);
  /** Chosen days no tile stands for: the calendar is the only thing on the sheet that can show them. */
  const untiled = [...draft.days].filter((at) => !tiles.some((tile) => tile.at === at));
  /** The day the calendar marks and stands open on: the latest of those, else the latest chosen. */
  const marked = untiled.length > 0 ? untiled : [...draft.days];
  const latest = marked.length === 0 ? null : new Date(Math.max(...marked));
  const [month, setMonth] = useState(() => latest ?? today);
  // Open from the start when the filter holds a day no tile shows: otherwise nothing on the sheet
  // would say which day the feed is cut to.
  const [calendar, setCalendar] = useState(untiled.length > 0);
  const toggleDay = (at: number) => setDraft((have) => ({ ...have, days: toggled(have.days, at) }));

  return (
    <Sheet
      visible
      onCancel={onCancel}
      // The heading and the small «Сбросить» are one row (spec 8), so they arrive as the head
      // rather than as a title with a button hung off it.
      head={
        <View style={styles.titleRow}>
          <Text role="sheetTitle" accessibilityRole="header" style={styles.title}>
            {s.gallery.filters}
          </Text>
          <Button
            variant="raise"
            icon={X}
            label={s.gallery.reset}
            // Nothing to clear is a button that says so by being off, not one that does nothing.
            disabled={!chosen}
            onPress={() => setDraft(FILTER_NONE)}
          />
        </View>
      }
      scroll
      footer={
        <Button
          variant="primary"
          label={
            shown === 0
              ? s.gallery.nothingMatched
              : chosen
                ? s.gallery.show(shown)
                : s.gallery.showAll
          }
          disabled={shown === 0}
          onPress={() => onApply(draft)}
        />
      }
    >
      <View style={styles.blocks}>
        <View style={styles.faces}>
          <GroupLabel>{s.gallery.whoBrought}</GroupLabel>
          {/* Faces and no names (spec 8): a person is known by their circle, and the whole name is
              what the circle is read out as. More than a row of them wraps onto the next. */}
          <FaceRow
            faces={people.map((person) => ({ ...person, selected: draft.people.has(person.id) }))}
            onToggle={(id) => setDraft((have) => ({ ...have, people: toggled(have.people, id) }))}
          />
        </View>

        <View style={styles.block}>
          <GroupLabel>{s.gallery.whatKind}</GroupLabel>
          <Segment
            wide
            // Inside a sheet the container is `ink`: the sheet itself is already `surface` (spec 7.3).
            onSurface
            hideLabel
            label={s.gallery.whatKind}
            value={draft.kind}
            onChange={(kind) => setDraft((have) => ({ ...have, kind }))}
            options={[
              { value: 'all', label: s.gallery.anyKind },
              { value: 'photo', label: s.media.photo },
              { value: 'video', label: s.media.video },
            ]}
          />
        </View>

        {/* «ЛЕЙБЛЫ» — the boxes of this memory, third of the four and between the type and the days
            (spec 10.8.2). This is how the contents of a label are looked at: there is no screen of
            its own for one, the feed is narrowed to it instead. A memory with no boxes has no group
            here at all rather than an empty row — and no private box of one's own simply makes the
            row shorter. */}
        {labels.length === 0 ? null : (
          <View style={styles.block}>
            <GroupLabel>{s.gallery.whichLabels}</GroupLabel>
            <View style={styles.chips}>
              {labels.map((label) => (
                <Chip
                  key={label.id}
                  label={label.title}
                  swatch={labelTint(label.color, theme)}
                  // A private one is marked and a shared one is not: there are more shared ones,
                  // and a glyph on every chip would be noise (spec 10.8.2).
                  icon={label.shared ? undefined : Lock}
                  // What the box holds — the count the api works out from the links themselves, so
                  // it is what is actually in there.
                  count={String(label.media_count)}
                  selected={draft.labels.has(label.id)}
                  onPress={() =>
                    setDraft((have) => ({ ...have, labels: toggled(have.labels, label.id) }))
                  }
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.block}>
          <View style={styles.dayHead}>
            <View style={styles.grow}>
              <GroupLabel>{s.gallery.whichDays}</GroupLabel>
            </View>
            {/* «Все дни» is the absence of a choice rather than a choice of its own, so pressing it
                is emptying the set and nothing else. */}
            <Chip
              size={28}
              label={s.gallery.anyDay}
              selected={draft.days.size === 0}
              onPress={() => setDraft((have) => ({ ...have, days: new Set() }))}
            />
            {/* A day the tiles are not offering — past the three fullest, or one that holds nothing
                at all. Held in while the calendar is open under the tiles. */}
            <IconButton
              size={height.chipTag}
              tone={calendar ? 'paper' : 'outline'}
              on={calendar}
              icon={CalendarDays}
              label={s.gallery.otherDay}
              onPress={() => setCalendar((open) => !open)}
            />
          </View>
          {tiles.length === 0 ? null : (
            <View style={styles.tiles}>
              {tiles.map((day) => {
                const date = new Date(day.at);
                const weekday = formatWeekday(date, undefined, 'short');
                const frames = s.memory.frames(day.count);
                return (
                  <DayTile
                    key={day.at}
                    day={String(date.getDate())}
                    weekday={weekday}
                    count={frames}
                    fill={day.fill}
                    label={s.gallery.dayTile(formatDayShort(date), weekday, frames)}
                    selected={draft.days.has(day.at)}
                    onPress={() => toggleDay(day.at)}
                  />
                );
              })}
            </View>
          )}
          {calendar ? (
            <Calendar
              month={month}
              onMonth={setMonth}
              // One day at a time here, not a span: the filter holds a set of days, and each tap on
              // the grid adds one to it or takes it back out.
              from={latest}
              to={null}
              onPick={(day) => toggleDay(startOfDay(day).getTime())}
              max={today}
              weekdays={weekdayLetters()}
              monthLabel={formatMonth(month)}
              prevLabel={s.create.prevMonth}
              nextLabel={s.create.nextMonth}
              dayLabel={formatDay}
            />
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}

/**
 * `SheetSort` — in what order to show it (spec 8), and nothing else: two rows of pills with every
 * answer visible at once. Whether the days are written between the strips is not decided here — it
 * is the account's «Даты между днями», one for every feed.
 *
 * Everything here takes effect as it is pressed: there is nothing to preview on a sheet standing
 * over the very thing it rearranges, so «Готово» is a way out and not a commitment.
 */
export function SortSheet({
  value,
  onChange,
  onDone,
}: {
  value: Sort;
  onChange: (sort: Sort) => void;
  onDone: () => void;
}) {
  const s = useStrings();
  const styles = useStyles();

  return (
    <Sheet
      visible
      onCancel={onDone}
      title={s.gallery.sorting}
      height={height.sheetSort}
      footer={<Button variant="primary" label={s.action.done} onPress={onDone} />}
    >
      <View style={styles.group}>
        <GroupLabel>{s.gallery.order}</GroupLabel>
        <Segment
          wide
          onSurface
          hideLabel
          label={s.gallery.order}
          value={value.order}
          onChange={(order: Order) => onChange({ ...value, order })}
          options={[
            { value: 'newest', label: s.gallery.orders.newest },
            { value: 'oldest', label: s.gallery.orders.oldest },
          ]}
        />
      </View>

      <View style={styles.group}>
        <GroupLabel>{s.gallery.groupBy}</GroupLabel>
        <Segment
          wide
          onSurface
          hideLabel
          label={s.gallery.groupBy}
          value={value.by}
          onChange={(by: GroupBy) => onChange({ ...value, by })}
          options={[
            { value: 'none', label: s.gallery.groups.none },
            { value: 'person', label: s.gallery.groups.person },
            { value: 'kind', label: s.gallery.groups.kind },
          ]}
        />
      </View>
    </Sheet>
  );
}

/**
 * `SheetFrameInfo` — everything about the open frame that the picture itself does not say (spec 8).
 * Only to look at: not one line of it is a control, and the one thing on it that leads anywhere is a
 * movie this frame ended up in.
 *
 * What to *do* with a frame is no longer a sheet at all — that is the glass menu the «⋯» drops
 * (spec 7.1, detail 9), and it lives on the window itself.
 *
 * The rule the whole sheet is built on: **a line the server knows nothing about is not drawn**. The
 * camera, the place and the movies are written by the montage worker, so an older frame legitimately
 * has none of them; `frameFacts` is where that is decided, and «В роликах» disappears with its own
 * rows the same way.
 */
export function FrameInfoSheet({
  visible,
  thumb,
  title,
  meta,
  info,
  error,
  onFilm,
  onClose,
}: {
  visible: boolean;
  thumb?: string;
  /** «13 сентября, 21:47» — when this frame happened, as the gallery reads it. */
  title: string;
  /** «суббота · Свадьба Лизы и Марка» — the day named, and what it was. */
  meta: string;
  /** null until the read comes back: the head is known from the frame, the rest is not. */
  info: FrameInfo | null;
  /** The api's own wording when that read failed. */
  error: string | null;
  onFilm: (montageId: string) => void;
  onClose: () => void;
}) {
  const s = useStrings();
  const styles = useStyles();
  const place = usePlaceName(info?.latitude, info?.longitude);

  return (
    <Sheet
      visible={visible}
      onCancel={onClose}
      head={
        <View style={styles.head}>
          {thumb ? <Image source={{ uri: thumb }} contentFit="cover" style={styles.thumb} /> : null}
          <View style={styles.headWords}>
            <Text role="section" numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            <Text role="meta" numberOfLines={1}>
              {meta}
            </Text>
          </View>
        </View>
      }
      // No footer: the sheet is closed by the darkness, the handle and the back key, like every
      // other one. A button saying «Закрыть» under a sheet that only shows things is furniture.
      scroll
    >
      {error !== null ? <Banner tone="error" text={error} /> : null}
      {info === null ? (
        error === null ? (
          // Wordless on purpose (spec 9): «никаких объяснений на экране, по которому ходят каждый
          // день». The head is already up, and what is missing is one short read.
          <View style={styles.waiting}>
            <Spinner />
          </View>
        ) : null
      ) : (
        <>
          {/* The person, on `ink` inside the sheet's own surface — the one block here that is
              about somebody rather than about a file. */}
          <View style={styles.author}>
            <Avatar name={memberName(info.uploaded_by)} size={32} />
            <View style={styles.headWords}>
              <Text role="row" numberOfLines={1}>
                {memberName(info.uploaded_by)}
              </Text>
              <Text role="meta" numberOfLines={1}>
                {s.viewer.brought(formatDayShort(info.created_at), info.uploaded_by.media_count)}
              </Text>
            </View>
          </View>

          <View style={styles.facts}>
            {frameFacts(info, s, undefined, place).map((fact, at) => (
              <RowSummary key={fact.label} label={fact.label} value={fact.value} divider={at > 0} />
            ))}
          </View>

          {info.montages.length === 0 ? null : (
            <View style={styles.group}>
              <Text role="meta" accessibilityRole="header">
                {s.viewer.inFilms}
              </Text>
              {info.montages.map((film) => {
                const runtime = formatRuntime(film.duration_seconds);
                return (
                  <RowFilmAt
                    // One frame may stand in the same movie twice — the second is part of the key.
                    key={`${film.id}:${film.start_seconds}`}
                    title={runtime ? s.montage.ofLength(runtime) : s.montage.count(1)}
                    at={s.viewer.at(formatRuntime(film.start_seconds) ?? '')}
                    onPress={() => onFilm(film.id)}
                  />
                );
              })}
            </View>
          )}
        </>
      )}
    </Sheet>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // A heading and the row it introduces, the way every group on the two tuning sheets is built.
    group: { gap: space.s2 },
    // Spec 8 — the heading of `SheetFilter` and the small «Сбросить» share one row.
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    title: { flex: 1, minWidth: 0 },
    // Spec 7.3: chips lie in a wrapping row 8 apart and wrap as they need to.
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
    // Spec 8, `SheetFilter`: 20 between its blocks, 12 under «Кто принёс», 10 under the others.
    blocks: { gap: space.s5 },
    faces: { gap: space.s3 },
    block: { gap: 10 },
    // «ДЕНЬ» takes the width, and «Все дни» and the calendar stand 10 apart at its right.
    dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    grow: { flex: 1, minWidth: 0 },
    // Spec 7.3, detail 74: the tiles share one row evenly, 8 apart — never a row that scrolls.
    tiles: { flexDirection: 'row', gap: space.s2 },
    // Spec 8: the header row of `SheetFrameInfo` is a 56 thumbnail and two lines beside it.
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    headWords: { flex: 1, minWidth: 0, gap: 3 },
    thumb: { width: 56, height: 56, borderRadius: radius.strip, backgroundColor: color.raise },
    waiting: { alignItems: 'center', paddingVertical: space.s5 },
    // Spec 8: the person stands on `ink` inside the sheet's own surface, ringed like a field.
    author: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingVertical: 10,
      paddingHorizontal: space.s3,
      borderRadius: radius.cell,
      backgroundColor: color.ink,
      borderWidth: 1,
      borderColor: color.line,
    },
    // The summary rows carry the screen's own 16 inside them, and the sheet has already spent it.
    facts: { marginHorizontal: -space.s4 },
  }),
);
