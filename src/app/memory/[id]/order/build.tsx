import { useRouter } from 'expo-router';
import { ChevronRight, Info } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { type MontageOrientation } from '@/api';
import { Button, Icon, ICO_S, Segment, Text } from '@/kit';
import { useStrings } from '@/language';
import { LENGTHS, type Length } from '@/montage';
import { useOrder, WizardStep } from '@/order-wizard';
import { space, themed, useTheme } from '@/theme';

/**
 * Step 4, `MontageBuild` — the shape of the thing, and the one warning. The warning stands before
 * the button, never after it.
 *
 * The last step of the walk and not the end of it: what follows is the summary (`MontageSummary`),
 * which is where the order is actually sent, so the button here only leads on. Nothing has left
 * the phone by this point except a track somebody sent up themselves.
 *
 * ponytail: the length is still the three round answers this step has always offered, while the
 * api now takes any whole number of seconds inside this memory's own range. The slider the layout
 * draws and the range it stands in are TASK-217; an untouched length is sent as nothing at all,
 * which is the api picking and clamping its own.
 */
export default function BuildStep() {
  const router = useRouter();
  const s = useStrings();
  const { id, order, change } = useOrder();
  const { color } = useTheme();
  const styles = useStyles();

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
    >
      <ScrollView contentContainerStyle={styles.body}>
        <Segment
          label={s.montage.howLong}
          wide
          options={LENGTHS.map((seconds) => ({
            value: String(seconds) as `${Length}`,
            label: s.montage.length[seconds],
          }))}
          // Nothing said is the api's own minute, clamped to what the material can carry — the
          // segment shows that minute and the body says nothing until somebody presses one.
          value={String(order.seconds ?? 60) as `${Length}`}
          onChange={(picked) => change({ seconds: Number(picked) })}
        />

        <Segment
          label={s.montage.shape}
          wide
          options={ORIENTATIONS.map((way) => ({ value: way, label: s.montage.orientation[way] }))}
          value={order.orientation}
          onChange={(orientation) => change({ orientation })}
        />

        <View style={styles.warn}>
          <Icon icon={Info} size={ICO_S} color={color.faint} />
          <Text role="meta" tone="faint" style={styles.grow}>
            {s.montage.onceOnly}
          </Text>
        </View>
      </ScrollView>
    </WizardStep>
  );
}

/** Both ways up, in the order the layout draws them. */
const ORIENTATIONS: readonly MontageOrientation[] = ['landscape', 'portrait'];

const useStyles = themed(() =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    body: { flexGrow: 1, paddingHorizontal: space.s4, paddingBottom: space.s6, gap: space.s5 },
    warn: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.s3,
      paddingHorizontal: space.s1,
    },
  }),
);
