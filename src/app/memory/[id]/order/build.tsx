import { useRouter } from 'expo-router';
import { Film, Info } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  ApiError,
  errorMessage,
  orderMontage,
  type MontageOrientation,
} from '@/api';
import { useAuth } from '@/auth';
import { Button, Icon, ICO_S, Segment, Text } from '@/kit';
import { useStrings } from '@/language';
import { LENGTHS, taken, wishes, type Length } from '@/montage';
import { useOrder, useStillHere, WizardStep } from '@/order-wizard';
import { space, themed, useTheme } from '@/theme';

/**
 * Step 4, `MontageBuild` — the shape of the thing, and the one warning. The warning stands before
 * the button, never after it.
 *
 * ponytail: the length is still the three round answers this step has always offered, while the
 * api now takes any whole number of seconds inside this memory's own range. The slider the layout
 * draws, the range it stands in and the summary after it are TASK-217 and TASK-218; until they
 * land this is the last step, so the button here is the one that sends the order — and an untouched
 * length is sent as nothing at all, which is the api picking and clamping its own.
 */
export default function BuildStep() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const { id, items, material, order, change } = useOrder();
  const { color } = useTheme();
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const gone = useStillHere();
  const inMovie = taken(material, order);

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
      // Onto the waiting for this one montage, and `replace` rather than `push`: the order is sent,
      // so the steps behind this screen are not somewhere to go back to — what is under the waiting
      // is the memory it was ordered from. The count of frames goes along because the wizard is the
      // only one who ever counts them; the api hands back what it wrote and not how many pictures
      // it adds up to.
      router.replace({
        pathname: '/memory/[id]/montage/[montageId]',
        params: { id, montageId: made.id, frames: inMovie.length },
      });
    } catch (e) {
      if (gone.current) return;
      // The material can still fall under the floor between the read on the way in and this call —
      // somebody else deleting what this order was counting on. The api's own line names its
      // numbers; these name what to do about them.
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

  return (
    <WizardStep
      step={4}
      title={s.montage.buildTitle}
      notice={notice}
      action={
        <Button
          variant="primary"
          wide
          icon={Film}
          label={s.montage.makeIt}
          busy={busy}
          onPress={() => void submit()}
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
