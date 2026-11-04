import { useFocusEffect, useRouter } from 'expo-router';
import { Aperture, ChevronRight, CircleSlash, Copy, ImageOff, SunDim } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
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
} from '@/lib/montage/order';
import { DensityPill, useDensityPinch } from '@/screens/memory/frames-density';
import { useOrder, WizardStep } from '@/screens/order/wizard';
import { space, themed } from '@/theme';

const POLL_MS = 3000;
const POLL_TRIES = 200;
export default function PickFramesStep() {
  const router = useRouter();
  const s = useStrings();
  const { id, material, order, change, refresh } = useOrder();
  const { token } = useAuth();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const density = useDensity();
  const pinch = useDensityPinch();
  const gap = density === 1 ? 0 : GRID_GAP;
  const cell = { width: (width - space.s4 * 2 - gap * 2) / density };
  const [showDropped, setShowDropped] = useState(false);
  const [analysis, setAnalysis] = useState<'idle' | 'running' | 'failed'>('idle');
  const polling = useRef<object | null>(null);
  useFocusEffect(
    useCallback(
      () => () => {
        polling.current = null;
        setAnalysis((was) => (was === 'running' ? 'idle' : was));
      },
      [],
    ),
  );
  const analyze = useCallback(async () => {
    if (!token || polling.current) return;
    const run = {};
    polling.current = run;
    setAnalysis('running');
    const stop = (face: 'idle' | 'failed') => {
      if (polling.current !== run) return;
      polling.current = null;
      setAnalysis(face);
    };
    const wanted = new Set(
      material.filter((item) => item.screening_rejected === null).map((item) => item.id),
    );
    try {
      await analyzeMemory(token, id);
      for (let tried = 0; polling.current === run && tried < POLL_TRIES; tried += 1) {
        await new Promise((done) => setTimeout(done, POLL_MS));
        if (polling.current !== run) return;
        const next = await refresh();
        if (polling.current !== run) return;
        if (next === null) return stop('failed');
        if (next.every((item) => !wanted.has(item.id) || item.screening_rejected !== null)) {
          return stop('idle');
        }
      }
      stop('failed');
    } catch {
      stop('failed');
    }
  }, [token, id, material, refresh]);
  const inMovie = taken(material, order);
  const passDropped = droppedByPass(material, order);
  const unspoken =
    material.length > 0 && !material.some((item) => item.screening_rejected !== null);
  const rows = useMemo(() => rowsOf(material, density), [material, density]);
  const enough = inMovie.length >= MIN_FRAMES;
  const count = s.montage.pickMeta(inMovie.length, material.length);
  const failed = analysis === 'failed';
  const running = analysis === 'running';
  return (
    <WizardStep
      step={1}
      title={s.montage.pickTitle}
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
                : running || unspoken
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
            ) : running || unspoken ? (
              <Button
                variant="small"
                label={s.montage.analyze}
                busy={running}
                busySize={16}
                onPress={() => void analyze()}
                style={styles.whatDropped}
              />
            ) : passDropped.length > 0 ? (
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
            polling.current = null;
            setAnalysis('idle');
            router.push({ pathname: '/memory/[id]/order/story', params: { id } });
          }}
        />
      }
      list={({ head, foot }) => (
        <View style={styles.pinch} testID="density-pinch" {...pinch.panHandlers}>
          <FlatList
            data={rows}
            keyExtractor={(row) => row[0]?.id ?? ''}
            contentContainerStyle={[styles.grid, { gap }]}
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
const REASON_SIGN: Record<Reason, IconComponent> = {
  blur: Aperture,
  duplicate: Copy,
  exposure: SunDim,
  unreadable: ImageOff,
  other: CircleSlash,
};
const useStyles = themed(() =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: '50%' },
    headLine: {
      minHeight: 44,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.s3,
    },
    whatDropped: { marginRight: -space.s1 },
    grid: { paddingHorizontal: space.s4, paddingBottom: space.s7 },
    edge: { marginHorizontal: -space.s4 },
    pinch: { flex: 1 },
    pill: { alignItems: 'center' },
    row: { flexDirection: 'row' },
  }),
);
