import { useFocusEffect, useRouter } from 'expo-router';
import { Aperture, ChevronRight, CircleSlash, Copy, ImageOff, SunDim } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { analyzeMemory } from '@/api';
import { Button, GRID_GAP, type IconComponent, RowRejected, Sheet, Text, Tile } from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatRuntime } from '@/lib/dates';
import { useDensity } from '@/lib/density';
import { rowsOf } from '@/lib/frames';
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
  usable,
} from '@/lib/montage/order';
import { DensityPill, useDensityPinch } from '@/screens/memory/frames-density';
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
 *
 * The automatic pass is the organizer's to start since m-43 (spec 10.15): it does not come down
 * with the material any more. Until every ready frame carries a verdict the line offers
 * «Проанализировать», and while the worker writes them the screen reads the material again and
 * again in place, never blanking the grid. A pass that dropped nothing says so and leaves no
 * button; one that failed says that instead and offers «Повторить». Finished, the pass is reused —
 * «Что сняли» stands where the analyze button was. None of it locks the step: «Дальше» works
 * through the whole run.
 */
const POLL_MS = 3000;

export default function PickFramesStep() {
  const router = useRouter();
  const s = useStrings();
  const { id, material, order, change, refresh } = useOrder();
  const { token } = useAuth();
  const styles = useStyles();
  /**
   * One column of the grid, worked out rather than flexed — `memory/frames.tsx` says why at length:
   * a `1fr` column is the same width in a last row of one as in a full row, and `flex: 1/3` is
   * not. How many across is the person's own setting (`@/lib/density`), the same one every gallery
   * is cut at, the single frame of the scale (spec 10.14.2) included — walked by the pinch hung on
   * the view below, and cut here with no gutter at that last step, so one frame stands the width the
   * grid has. The grid stands inside the screen's own 16 margins.
   */
  const { width } = useWindowDimensions();
  const density = useDensity();
  const pinch = useDensityPinch();
  const gap = density === 1 ? 0 : GRID_GAP;
  const cell = { width: (width - space.s4 * 2 - gap * 2) / density };
  /** Whether `SheetRejected` is up — what the automatic pass dropped, and why. */
  const [showDropped, setShowDropped] = useState(false);

  /**
   * Where the automatic pass stands: `running` from the press until every visible frame has a
   * verdict, and `failed` when the call or a read of the material did not go through. The pass
   * itself is not the state — whether it has spoken is read off the frames, `screening_rejected`
   * being `null` until it does — so the view follows rereads by itself.
   */
  const [analysis, setAnalysis] = useState<'idle' | 'running' | 'failed'>('idle');
  /** Whether the run still wants its readings. Cleared by leaving the step or by a failure. */
  const polling = useRef(false);
  useFocusEffect(
    useCallback(
      () => () => {
        polling.current = false;
      },
      [],
    ),
  );
  // Unmounted is left as well, and the read already in flight must not bring a step back.
  useEffect(
    () => () => {
      polling.current = false;
    },
    [],
  );

  const analyze = useCallback(async () => {
    if (!token || polling.current) return;
    polling.current = true;
    setAnalysis('running');
    try {
      await analyzeMemory(token, id);
    } catch {
      if (!polling.current) return;
      polling.current = false;
      setAnalysis('failed');
      return;
    }
    // The worker writes verdicts frame by frame; read until every ready one has one. Not faster
    // than `POLL_MS`: the pass is short, and hammering the material for it helps nobody.
    while (polling.current) {
      await new Promise((done) => setTimeout(done, POLL_MS));
      if (!polling.current) return;
      const next = await refresh();
      if (!polling.current) return;
      if (next === null) {
        polling.current = false;
        setAnalysis('failed');
        return;
      }
      if (usable(next).every((item) => item.screening_rejected !== null)) {
        polling.current = false;
        setAnalysis('idle');
        return;
      }
    }
  }, [token, id, refresh]);

  const inMovie = taken(material, order);
  const passDropped = droppedByPass(material, order);
  /** Some ready frame the pass has not spoken about yet — the analyze button's own question. */
  const pending = material.some((item) => item.screening_rejected === null);
  // Cut by hand rather than `numColumns`, the way the galleries cut theirs, and through the one
  // `rowsOf` they all use.
  const rows = useMemo(() => rowsOf(material, density), [material, density]);

  /**
   * Under three taken there is nothing to cut, and the one step that can put an order below the
   * floor is this one. It says so by going dark rather than by refusing the press silently: the
   * api counts the ready material for its 409 and never the selection, and so does the worker, so
   * an order taking one frame out of twenty is accepted and cut into a one-frame «ролик» against
   * a minute that was asked for (found in review).
   */
  const enough = inMovie.length >= MIN_FRAMES;
  const count = s.montage.pickMeta(inMovie.length, material.length);
  const failed = analysis === 'failed';
  const running = analysis === 'running';

  return (
    <WizardStep
      step={1}
      title={s.montage.pickTitle}
      /* The count and the way into what the pass dropped, on one line: the pass reports here and
         explains itself there. Spec 10.15 — until every frame has a verdict this line offers the
         pass itself; finished, it reports and leaves no button when nothing was dropped; failed,
         the error takes the count's place. The line keeps its 44 whatever it holds, so the grid
         under it never jumps. While the pinch is walking the density, the pill takes this line's
         place (spec 10.14.1) — the same slot the feed's pill takes of the glass bar's capsule. */
      head={
        pinch.pinching || pinch.leaving ? (
          <View style={styles.pill}>
            <DensityPill value={density} leaving={pinch.leaving} />
          </View>
        ) : (
          <View style={styles.headLine}>
            <Text role="label" tone={failed ? 'danger' : 'muted'} style={styles.grow}>
              {failed
                ? s.montage.analyzeFailed
                : pending
                  ? count
                  : passDropped.length > 0
                    ? `${count} · ${s.montage.passDropped(passDropped.length)}`
                    : `${count} · ${s.montage.nothingToDrop}`}
            </Text>
            {failed ? (
              <Button
                variant="small"
                label={s.action.retry}
                onPress={() => void analyze()}
                style={styles.whatDropped}
              />
            ) : pending ? (
              // The spinner takes the sign's place and the words stay put (spec 10.15), so the
              // button does not resize while it waits.
              <Button
                variant="small"
                label={s.montage.analyze}
                busy={running}
                busySize={16}
                onPress={() => void analyze()}
                style={styles.whatDropped}
              />
            ) : passDropped.length > 0 ? (
              // Spec 7.2 — the small one, outlined in `line` and as wide as its words: a button the
              // width of the row squeezes the count to nothing.
              <Button
                variant="small"
                label={s.montage.whatDropped}
                onPress={() => setShowDropped(true)}
                style={styles.whatDropped}
              />
            ) : null}
          </View>
        )
      }
      above={enough ? undefined : <Text role="meta">{s.montage.keepAtLeast(MIN_FRAMES)}</Text>}
      action={
        <Button
          variant="primary"
          wide
          trailingIcon={ChevronRight}
          label={s.montage.nextWith(inMovie.length)}
          disabled={!enough}
          onPress={() => {
            // Leaving the step stops its readings: the next step may stand over this one, and the
            // pass is no longer the screen's business.
            polling.current = false;
            router.push({ pathname: '/memory/[id]/order/story', params: { id } });
          }}
        />
      }
      list={({ head, foot }) => (
        // The grid stands in a view of its own so a two-finger pinch is taken off the scroll before
        // it begins (spec 10.14.1); a one-finger drag scrolls the grid as it always did.
        <View style={styles.pinch} testID="density-pinch" {...pinch.panHandlers}>
          <FlatList
            data={rows}
            keyExtractor={(row) => row[0]?.id ?? ''}
            contentContainerStyle={[styles.grid, { gap }]}
            // Scrolling with the frames, the bar and the bottom layer keep the screen's edges and not
            // the grid's margins.
            ListHeaderComponent={head ? <View style={styles.edge}>{head}</View> : null}
            ListFooterComponent={foot ? <View style={styles.edge}>{foot}</View> : null}
            renderItem={({ item: row }) => (
              <View style={[styles.row, { gap }]}>
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
        </View>
      )}
    >
      <Sheet
        visible={showDropped}
        onCancel={() => setShowDropped(false)}
        title={s.montage.droppedTitle}
        // Spec 8, `SheetRejected`: the paragraph stands 8 under the heading, one block with it.
        lead={
          <Text role="bodyXs" tone="muted">
            {s.montage.droppedText(passDropped.length, material.length)}
          </Text>
        }
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
              size="ms"
              wide
              label={s.montage.leaveAsIs}
              onPress={() => setShowDropped(false)}
            />
          </>
        }
      >
        {/* One list, row under row with a hairline between them — the sheet's gap stands around
            it, never inside it. */}
        <View>
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
        </View>
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
    // At least half the row: on large type «Что сняли» goes under the count rather than squeeze it
    // letter by letter (TASK-375), and on the ordinary one it stays beside it, as drawn.
    grow: { flex: 1, minWidth: '50%' },
    // Spec 10.15: 44 whichever face the line wears — the count alone, a button, a spinner, the
    // error — so the grid under it never jumps. The line wraps when the words outgrow the row.
    headLine: {
      minHeight: 44,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.s3,
    },
    // The layout hangs it 4 past the screen's margin (`MontageSelect`: its right edge at 378).
    whatDropped: { marginRight: -space.s1 },
    // The rows' gutter is the grid's own and follows the density: the layout's 3 between rows, and
    // nought at the single frame (spec 10.14.2), where the frames stand touching.
    grid: { paddingHorizontal: space.s4, paddingBottom: space.s7 },
    edge: { marginHorizontal: -space.s4 },
    // The view the grid and the pinch stand in: nothing of its own but the room the list fills.
    pinch: { flex: 1 },
    // Where the pill stands in the head line's place while the pinch walks the density, centred as
    // the feed's pill is in the capsule's slot.
    pill: { alignItems: 'center' },
    // The gutter between the columns is the row's own — 0 at the single frame (spec 10.14.2), so one
    // frame stands the whole width of the grid.
    row: { flexDirection: 'row' },
  }),
);
