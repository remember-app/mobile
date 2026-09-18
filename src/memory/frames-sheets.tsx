import { Image } from 'expo-image';
import { Download, Share, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatDay } from '@/dates';
import { FILTER_NONE, filtering, type Filter, type GroupBy, type Order, type Sort } from '@/frames';
import { Button, Chip, RowAction, Segment, Sheet, Text } from '@/kit';
import { useStrings } from '@/language';
import { radius, space, themed } from '@/theme';

/**
 * The sheets the gallery raises (spec 8): the two it is tuned from — the left round button at the
 * foot of the screen opens the one that decides **what** is shown, the right one the sheet that
 * decides **in what order** — and the one the open frame raises, «что сделать с кадром». Their own
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

/** A chip pressed on or off again, without disturbing the set it came from. */
function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

/**
 * `SheetFilter` — what of the gallery to show. Three groups: who brought it, what it is, which days
 * it is from. The first chip of the two chip rows is the one that holds nothing back, and it is what
 * an empty set means.
 *
 * The choices are a draft until the glowing button is pressed: it carries the number of frames they
 * would leave on screen, worked out on the spot, so nobody applies a filter without being told first
 * what it comes to — and a filter that comes to nothing cannot be applied at all («Ничего не
 * подошло»). Closing the sheet any other way leaves the gallery exactly as it was.
 */
export function FilterSheet({
  people,
  days,
  value,
  count,
  onApply,
  onCancel,
}: {
  /** Everybody who actually brought something, by the name the roster writes. */
  people: readonly { id: string; name: string }[];
  /** Every day the gallery holds, newest first. */
  days: readonly number[];
  value: Filter;
  /** How many frames a draft would leave — the face owns the material, this only asks it. */
  count: (draft: Filter) => number;
  onApply: (filter: Filter) => void;
  onCancel: () => void;
}) {
  const s = useStrings();
  const styles = useStyles();
  // Seeded once, because this sheet is mounted by being opened: what was applied is what it opens on.
  const [draft, setDraft] = useState<Filter>(value);
  const shown = count(draft);

  return (
    <Sheet
      visible
      onCancel={onCancel}
      title={s.gallery.filters}
      // Many people, many days: the two chip rows wrap, and past a screenful the body scrolls under
      // a heading and a footer that stay put.
      scroll
      footer={
        <>
          <Button
            variant="primary"
            label={shown === 0 ? s.gallery.nothingMatched : s.gallery.show(shown)}
            disabled={shown === 0}
            onPress={() => onApply(draft)}
          />
          <Button
            variant="quiet"
            wide
            label={s.gallery.reset}
            // Nothing to clear is a button that says so by being off, not one that does nothing.
            disabled={!filtering(draft)}
            onPress={() => setDraft(FILTER_NONE)}
          />
        </>
      }
    >
      <View style={styles.group}>
        <GroupLabel>{s.gallery.whoBrought}</GroupLabel>
        <View style={styles.chips}>
          {/* «Все» is the absence of a choice rather than a choice of its own, so pressing it is
              emptying the set and nothing else. */}
          <Chip
            label={s.gallery.anyone}
            selected={draft.people.size === 0}
            onPress={() => setDraft((have) => ({ ...have, people: new Set() }))}
          />
          {people.map((person) => (
            <Chip
              key={person.id}
              label={person.name}
              avatar={person.name}
              selected={draft.people.has(person.id)}
              onPress={() =>
                setDraft((have) => ({ ...have, people: toggled(have.people, person.id) }))
              }
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
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

      <View style={styles.group}>
        <GroupLabel>{s.gallery.whichDays}</GroupLabel>
        <View style={styles.chips}>
          <Chip
            label={s.gallery.anyDay}
            selected={draft.days.size === 0}
            onPress={() => setDraft((have) => ({ ...have, days: new Set() }))}
          />
          {days.map((day) => (
            <Chip
              key={day}
              label={formatDay(new Date(day))}
              selected={draft.days.has(day)}
              onPress={() => setDraft((have) => ({ ...have, days: toggled(have.days, day) }))}
            />
          ))}
        </View>
      </View>
    </Sheet>
  );
}

/**
 * `SheetSort` — in what order to show it. Two questions, both answered by a row of pills with every
 * answer visible at once, and both take effect as they are pressed: there is nothing to preview
 * here, so «Готово» is a way out and not a commitment.
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
      footer={<Button variant="primary" label={s.action.done} onPress={onDone} />}
    >
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
            { value: 'day', label: s.gallery.groups.day },
            { value: 'person', label: s.gallery.groups.person },
            { value: 'kind', label: s.gallery.groups.kind },
          ]}
        />
      </View>

      <View style={styles.group}>
        <GroupLabel>{s.gallery.within}</GroupLabel>
        <Segment
          wide
          onSurface
          hideLabel
          label={s.gallery.within}
          value={value.order}
          onChange={(order: Order) => onChange({ ...value, order })}
          options={[
            { value: 'newest', label: s.gallery.orders.newest },
            { value: 'oldest', label: s.gallery.orders.oldest },
          ]}
        />
      </View>
    </Sheet>
  );
}

/**
 * `SheetFrame` — what to do with the frame that is open (spec 8). A header row saying which frame
 * this is about, the three errands one under another, and the way out at the bottom.
 *
 * The delete is the only red thing here and the only irreversible one; it is absent altogether for
 * somebody who may not delete this frame, rather than standing there greyed. It does not delete
 * anything itself either — it hands the viewer back to `SheetConfirmDelete`, which names the price.
 */
export function FrameSheet({
  visible,
  title,
  meta,
  thumb,
  onSave,
  onShare,
  onDelete,
  onClose,
}: {
  visible: boolean;
  /** What the frame is — «Фото», «Видео». */
  title: string;
  /** «Марк Ковалёв · 12–14 сентября · 4,2 МБ». */
  meta: string;
  thumb?: string;
  onSave: () => void;
  onShare: () => void;
  /** Left off when this frame is not the caller's to delete. */
  onDelete?: () => void;
  onClose: () => void;
}) {
  const s = useStrings();
  const styles = useStyles();

  return (
    <Sheet
      visible={visible}
      onCancel={onClose}
      head={
        <View style={styles.head}>
          {thumb ? (
            <Image source={{ uri: thumb }} contentFit="cover" style={styles.thumb} />
          ) : null}
          <View style={styles.headWords}>
            <Text role="row" numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            <Text role="meta" numberOfLines={1}>
              {meta}
            </Text>
          </View>
        </View>
      }
      // Spec 7.1, the fifth kind of bottom block: one button, outlined. Nothing on this sheet is a
      // main action — the actions are the rows.
      footer={<Button variant="secondary" size="md" label={s.action.close} onPress={onClose} />}
    >
      <View>
        <RowAction icon={Download} label={s.viewer.saveToPhone} onPress={onSave} />
        <RowAction icon={Share} label={s.action.share} onPress={onShare} divider />
        {onDelete ? (
          <RowAction icon={Trash2} label={s.viewer.remove} danger onPress={onDelete} divider />
        ) : null}
      </View>
    </Sheet>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // A heading and the row it introduces, the way every group on the two tuning sheets is built.
    group: { gap: space.s2 },
    // Spec 7.3: chips lie in a wrapping row 8 apart and wrap as they need to.
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
    // Spec 8: the header row of `SheetFrame` is a 52 thumbnail and two lines beside it.
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    headWords: { flex: 1, minWidth: 0, gap: 3 },
    thumb: { width: 52, height: 52, borderRadius: radius.thumb, backgroundColor: color.raise },
  }),
);
