import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { type MontageOrientation, type MontagePreview, previewMontage } from '@/api';
import { Banner, Button, LengthSlider, Segment, Text, Waiting } from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatRuntime } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import { PRESETS, taken, wishes } from '@/lib/montage/order';
import { refusal, useOrder, WizardStep } from '@/screens/order/wizard';
import { space, themed, wizardLead } from '@/theme';
export default function BuildStep() {
  const router = useRouter();
  const s = useStrings();
  const { token } = useAuth();
  const { id, items, reread, material, order, change } = useOrder();
  const styles = useStyles();
  const [failed, setFailed] = useState<string | null>(null);
  const [preview, setPreview] = useState<MontagePreview | null>(null);
  const going = taken(material, order)
    .map((item) => item.id)
    .join(',');
  useEffect(() => {
    if (!token || items === null) return;
    let here = true;
    setPreview(null);
    setFailed(null);
    previewMontage(token, id, {
      ...wishes(items, order),
      target_seconds: undefined,
    }).then(
      (answer) => {
        if (here) setPreview(answer);
      },
      (e: unknown) => {
        if (here) setFailed(refusal(e).text);
      },
    );
    return () => {
      here = false;
    };
  }, [token, id, items, going]);
  useEffect(() => {
    if (preview === null || order.seconds === null) return;
    const held = Math.min(Math.max(order.seconds, preview.min_seconds), preview.max_seconds);
    if (held !== order.seconds) change({ seconds: held });
  }, [preview, order.seconds, change]);
  const seconds = order.seconds ?? preview?.target_seconds ?? null;
  const template = order.template;
  return (
    <WizardStep
      step={4}
      title={s.montage.buildTitle}
      action={
        <Button
          variant="primary"
          wide
          trailingIcon={ChevronRight}
          label={s.montage.toSummary}
          onPress={() => router.push({ pathname: '/memory/[id]/order/summary', params: { id } })}
        />
      }
      body={styles.body}
    >
      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text role="eyebrow" tone="muted" accessibilityRole="header" style={styles.grow}>
            {s.montage.howLong.toUpperCase()}
          </Text>
          {preview ? (
            <Text role="meta">
              {s.montage.lengthUpTo(formatRuntime(preview.max_seconds) ?? '')}
            </Text>
          ) : null}
        </View>

        {failed !== null ? (
          <Banner tone="error" text={failed}>
            <Button size="xs" variant="quiet" label={s.action.retry} onPress={reread} />
          </Banner>
        ) : preview === null || seconds === null ? (
          <Waiting text={s.state.loading} size={26} />
        ) : (
          <LengthSlider
            value={seconds}
            onChange={(next) => change({ seconds: next, ownLength: true })}
            min={preview.min_seconds}
            max={preview.max_seconds}
            valueLabel={formatRuntime(seconds) ?? ''}
            note={
              template && !order.ownLength
                ? s.montage.lengthFromTemplate(s.montage.template[template])
                : undefined
            }
            minLabel={formatRuntime(preview.min_seconds) ?? ''}
            maxLabel={s.montage.lengthEnd(formatRuntime(preview.max_seconds) ?? '')}
            label={s.montage.howLong}
            shorterLabel={s.montage.shorter}
            longerLabel={s.montage.longer}
            presets={[
              ...PRESETS.map((value) => ({ label: formatRuntime(value) ?? '', value })),
              { label: s.montage.lengthAll, value: preview.max_seconds },
            ]}
          />
        )}
      </View>

      <Segment
        label={s.montage.shape}
        options={ORIENTATIONS.map((way) => ({ value: way, label: s.montage.orientation[way] }))}
        value={order.orientation}
        onChange={(orientation) => change({ orientation })}
      />
    </WizardStep>
  );
}
const ORIENTATIONS: readonly MontageOrientation[] = ['landscape', 'portrait'];
const useStyles = themed(() =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    body: {
      flexGrow: 1,
      paddingHorizontal: space.s4,
      paddingTop: wizardLead.title,
      paddingBottom: space.s6,
      gap: 18,
    },
    block: { gap: space.s2 },
    blockHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
  }),
);
