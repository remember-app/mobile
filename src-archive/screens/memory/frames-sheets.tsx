import { CalendarDays, Lock, X } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Label } from '@/api';
import {
  BlockHead,
  Button,
  Calendar,
  Chip,
  DayTile,
  FaceRow,
  IconButton,
  Segment,
  Shares,
  Sheet,
  Text,
} from '@/kit';
import {
  formatDay,
  formatDayShort,
  formatMonth,
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
  type GroupBy,
  type Order,
  type Sort,
} from '@/lib/frames';
import { labelTint } from '@/lib/labels';
import { useStrings } from '@/lib/language';
import { height, space, themed, useTheme } from '@/theme';

function GroupLabel({ children }: { children: string }) {
  return (
    <Text role="eyebrow" tone="muted" accessibilityRole="header">
      {children.toUpperCase()}
    </Text>
  );
}
function SectionHead({
  label,
  open,
  onAll,
  children,
}: {
  label: string;
  open: boolean;
  onAll: () => void;
  children?: ReactNode;
}) {
  const s = useStrings();
  return (
    <BlockHead label={label.toUpperCase()}>
      <Chip
        size={28}
        toggle
        label={s.gallery.all}
        name={s.gallery.allOf(label)}
        selected={open}
        onPress={onAll}
      />
      {children}
    </BlockHead>
  );
}
function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}
export function FilterSheet({
  people,
  labels,
  days,
  value,
  count,
  onApply,
  onCancel,
}: {
  people: readonly {
    id: string;
    name: string;
  }[];
  labels: readonly Label[];
  days: readonly FilterDay[];
  value: Filter;
  count: (draft: Filter) => number;
  onApply: (filter: Filter) => void;
  onCancel: () => void;
}) {
  const s = useStrings();
  const styles = useStyles();
  const theme = useTheme();
  const [draft, setDraft] = useState<Filter>(value);
  const shown = count(draft);
  const chosen = filtering(draft);
  const today = useMemo(() => new Date(), []);
  const tiles = useMemo(() => dayTiles(days), [days]);
  const untiled = [...draft.days].filter((at) => !tiles.some((tile) => tile.at === at));
  const marked = untiled.length > 0 ? untiled : [...draft.days];
  const latest = marked.length === 0 ? null : new Date(Math.max(...marked));
  const [month, setMonth] = useState(() => latest ?? today);
  const [calendar, setCalendar] = useState(untiled.length > 0);
  const toggleDay = (at: number) => setDraft((have) => ({ ...have, days: toggled(have.days, at) }));
  const change = (part: Partial<Filter>) => setDraft((have) => ({ ...have, ...part }));
  return (
    <Sheet
      visible
      onCancel={onCancel}
      head={
        <View style={styles.titleRow}>
          <Text role="sheetTitle" accessibilityRole="header" style={styles.title}>
            {s.gallery.filters}
          </Text>
          <Button
            variant="raise"
            icon={X}
            label={s.gallery.reset}
            disabled={!chosen}
            onPress={() => setDraft(FILTER_NONE)}
          />
        </View>
      }
      rhythm="tuning"
      height={height.sheetFilter}
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
      <View style={styles.faces}>
        <SectionHead
          label={s.gallery.whoBrought}
          open={draft.people.size === 0}
          onAll={() => change({ people: new Set() })}
        />

        <FaceRow
          faces={people.map((person) => ({ ...person, selected: draft.people.has(person.id) }))}
          onToggle={(id) => setDraft((have) => ({ ...have, people: toggled(have.people, id) }))}
        />
      </View>

      <View style={styles.block}>
        <SectionHead
          label={s.gallery.whatKind}
          open={draft.kind === null}
          onAll={() => change({ kind: null })}
        />
        <Segment
          onSurface
          hideLabel
          label={s.gallery.whatKind}
          value={draft.kind}
          onChange={(kind) => change({ kind })}
          onClear={() => change({ kind: null })}
          options={[
            { value: 'photo', label: s.media.photo },
            { value: 'video', label: s.media.video },
          ]}
        />
      </View>

      <View style={styles.block}>
        <SectionHead
          label={s.gallery.whichOrientation}
          open={draft.orientation === null}
          onAll={() => change({ orientation: null })}
        />
        <Segment
          onSurface
          hideLabel
          label={s.gallery.whichOrientation}
          value={draft.orientation}
          onChange={(orientation) => change({ orientation })}
          onClear={() => change({ orientation: null })}
          options={[
            { value: 'landscape', label: s.gallery.orientations.landscape },
            { value: 'portrait', label: s.gallery.orientations.portrait },
          ]}
        />
      </View>

      {labels.length === 0 ? null : (
        <View style={styles.block}>
          <SectionHead
            label={s.gallery.whichLabels}
            open={draft.labels.size === 0}
            onAll={() => change({ labels: new Set() })}
          />
          <View style={styles.chips}>
            {labels.map((label) => (
              <Chip
                key={label.id}
                label={label.title}
                swatch={labelTint(label.color, theme)}
                icon={label.shared ? undefined : Lock}
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

      {days.length > 1 ? (
        <View style={styles.block}>
          <SectionHead
            label={s.gallery.whichDays}
            open={draft.days.size === 0}
            onAll={() => change({ days: new Set() })}
          >
            <IconButton
              size={height.chipTag}
              tone={calendar ? 'paper' : 'outline'}
              on={calendar}
              icon={CalendarDays}
              label={s.gallery.otherDay}
              onPress={() => setCalendar((open) => !open)}
            />
          </SectionHead>
          {tiles.length === 0 ? null : (
            <Shares>
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
            </Shares>
          )}
          {calendar ? (
            <Calendar
              month={month}
              onMonth={setMonth}
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
      ) : null}
    </Sheet>
  );
}
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
      rhythm="tuning"
      height={height.sheetSort}
      footer={<Button variant="primary" label={s.action.done} onPress={onDone} />}
    >
      <View style={styles.block}>
        <GroupLabel>{s.gallery.order}</GroupLabel>
        <Segment
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

      <View style={styles.block}>
        <GroupLabel>{s.gallery.groupBy}</GroupLabel>
        <Segment
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
const useStyles = themed(() =>
  StyleSheet.create({
    titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s3 },
    title: { flexGrow: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
    faces: { gap: space.s3 },
    block: { gap: 10 },
  }),
);
