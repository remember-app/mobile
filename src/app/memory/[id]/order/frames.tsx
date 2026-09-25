import { useRouter } from 'expo-router';
import { Aperture, ChevronRight, CircleSlash, Copy, ImageOff, SunDim } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, GRID_GAP, type IconComponent, RowRejected, Sheet, Text, Tile } from '@/kit';
import { formatRuntime } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import {
  afterTap,
  droppedByPass,
  MIN_FRAMES,
  pickOf,
  type Reason,
  reasonOf,
  rejectedGroups,
  taken,
} from '@/lib/montage/order';
import { useOrder, WizardStep } from '@/screens/order/wizard';
import { space, themed } from '@/theme';

/**
 * Step 1, `MontageSelect` — the automatic pass reports and the organizer rules. Every tile is one
 * of four things: going in, dropped by the pass with the reason on it, dropped by hand, or a video
 * with its running time; and a tap moves any of them to the other side.
 *
 * The first of the four steps, and the first place the material itself is met: what the pass
 * proposed is on the grid, what it dropped is behind «Что сняли», and neither is a verdict. What
 * stands in front of it is `MontageTemplate` (`index.tsx`), which is the way into the order — this
 * step is reached from «Настроить самому» there, or walked through by the autopilot.
 */
export default function PickFramesStep() {
  const router = useRouter();
  const s = useStrings();
  const { id, material, order, change } = useOrder();
  const styles = useStyles();
  /**
   * One column of the grid, worked out rather than flexed — `memory/frames.tsx` says why at length:
   * a `1fr` column is the same width in a last row of one as in a full row of three, and
   * `flex: 1/3` is not. This grid stands inside the screen's own 16 margins.
   */
  const { width } = useWindowDimensions();
  const cell = { width: (width - space.s4 * 2 - GRID_GAP * 2) / 3 };
  /** Whether `SheetRejected` is up — what the automatic pass dropped, and why. */
  const [showDropped, setShowDropped] = useState(false);

  const inMovie = taken(material, order);
  const passDropped = droppedByPass(material, order);
  // Three to a row by hand rather than `numColumns`, the way both galleries cut theirs.
  const rows = useMemo(
    () =>
      Array.from({ length: Math.ceil(material.length / 3) }, (_, i) =>
        material.slice(i * 3, i * 3 + 3),
      ),
    [material],
  );

  /**
   * Under three taken there is nothing to cut, and the one step that can put an order below the
   * floor is this one. It says so by going dark rather than by refusing the press silently: the
   * api counts the ready material for its 409 and never the selection, and so does the worker, so
   * an order taking one frame out of twenty is accepted and cut into a one-frame «ролик» against
   * a minute that was asked for (found in review).
   */
  const enough = inMovie.length >= MIN_FRAMES;

  return (
    <WizardStep
      step={1}
      title={s.montage.pickTitle}
      /* The count and the way into what the pass dropped, on one line: the pass reports here and
         explains itself there. No button while it has dropped nothing. */
      head={
        <View style={styles.headLine}>
          <Text role="label" tone="muted" style={styles.grow}>
            {passDropped.length > 0
              ? `${s.montage.pickMeta(inMovie.length, material.length)} · ${s.montage.passDropped(passDropped.length)}`
              : s.montage.pickMeta(inMovie.length, material.length)}
          </Text>
          {passDropped.length > 0 ? (
            // As wide as its words: a button the width of the row squeezes the count to nothing.
            <Button
              size="sm"
              wide={false}
              label={s.montage.whatDropped}
              onPress={() => setShowDropped(true)}
            />
          ) : null}
        </View>
      }
      above={
        enough ? undefined : (
          <Text role="meta" tone="faint">
            {s.montage.keepAtLeast(MIN_FRAMES)}
          </Text>
        )
      }
      action={
        <Button
          variant="primary"
          wide
          trailingIcon={ChevronRight}
          label={s.montage.nextWith(inMovie.length)}
          disabled={!enough}
          onPress={() => router.push({ pathname: '/memory/[id]/order/story', params: { id } })}
        />
      }
      list={({ head, foot }) => (
        <FlatList
          data={rows}
          keyExtractor={(row) => row[0]?.id ?? ''}
          contentContainerStyle={styles.grid}
          // Scrolling with the frames, the bar and the bottom layer keep the screen's edges and not
          // the grid's margins.
          ListHeaderComponent={head ? <View style={styles.edge}>{head}</View> : null}
          ListFooterComponent={foot ? <View style={styles.edge}>{foot}</View> : null}
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
                    length={
                      item.kind === 'video' ? formatRuntime(item.duration_seconds) : undefined
                    }
                    reason={
                      pick === 'auto'
                        ? { icon: REASON_SIGN[reason], label: s.montage.reason[reason] }
                        : undefined
                    }
                    label={pick === 'keep' ? s.montage.inMovie : s.montage.outOfMovie}
                    onPress={() => change(afterTap(item, order))}
                    style={cell}
                  />
                );
              })}
            </View>
          )}
        />
      )}
    >
      <Sheet
        visible={showDropped}
        onCancel={() => setShowDropped(false)}
        title={s.montage.droppedTitle}
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
              wide={false}
              label={s.montage.bringBack}
              onPress={() => change({ returned: new Set([...order.returned, ...group.ids]) })}
            />
          </RowRejected>
        ))}
      </Sheet>
    </WizardStep>
  );
}

/** The glyph each reason of the automatic pass wears, on the tile and in the sheet (spec 7.4). */
const REASON_SIGN: Record<Reason, IconComponent> = {
  blur: Aperture,
  duplicate: Copy,
  exposure: SunDim,
  unreadable: ImageOff,
  other: CircleSlash,
};

const useStyles = themed(() =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    headLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s3 },
    grid: { paddingHorizontal: space.s4, paddingBottom: space.s7, gap: GRID_GAP },
    edge: { marginHorizontal: -space.s4 },
    row: { flexDirection: 'row', gap: GRID_GAP },
  }),
);
