import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  ApiError,
  errorMessage,
  orderMontage,
  previewMontage,
  type MontageOrientation,
  type MontagePreview,
} from '@/api';
import { useAuth } from '@/auth';
import { formatRuntime } from '@/dates';
import { Button, LengthSlider, Segment, Text, Waiting } from '@/kit';
import { useStrings } from '@/language';
import { PRESETS, taken, wishes } from '@/montage';
import { useOrder, useStillHere, WizardStep } from '@/order-wizard';
import { space, themed } from '@/theme';

/**
 * Step 4, `MontageBuild` — how long it runs and which way up, and nothing else.
 *
 * The length is any whole number of seconds between the two walls this memory's own material puts
 * up (doc-03), and neither wall is worked out here: the app asks the api what the frames it is
 * about to order come to (`POST …/montages/preview`, which writes nothing) and draws the answer.
 * Asked again whenever the selection changes, because taking frames out of the film takes seconds
 * out of what there is to fill — a ceiling counted once on the way in would offer a length the
 * order would then be refused for.
 *
 * ponytail: the summary this button is named after is the next card (TASK-218), so «К итогу» still
 * does what the last step of the wizard has always done — places the order and leads to the
 * waiting over it. The step that reads the order back stands between them the moment it exists.
 */
export default function BuildStep() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const { id, items, material, order, change } = useOrder();
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** What the api says this order comes to. Null until it has answered — there is no guess here. */
  const [preview, setPreview] = useState<MontagePreview | null>(null);
  const gone = useStillHere();
  const inMovie = taken(material, order);
  /** The frames going in, as one word: the range is worked out from exactly these and nothing else. */
  const going = inMovie.map((item) => item.id).join(',');

  useEffect(() => {
    if (!token || items === null) return;
    let here = true;
    previewMontage(token, id, {
      ...wishes(items, order),
      // The question is what the material can carry, so the length is left out of it: asked with
      // one the frames no longer stretch to, the api answers 400 instead of the new range.
      target_seconds: undefined,
    }).then(
      (answer) => {
        if (!here) return;
        setPreview(answer);
        // The material may have shrunk under a length already chosen — walking back to step 1 and
        // dropping half the frames is all it takes. The figure comes down with it rather than
        // standing there until the order is refused.
        const held = Math.min(Math.max(order.seconds ?? 0, answer.min_seconds), answer.max_seconds);
        if (order.seconds !== null && held !== order.seconds) change({ seconds: held });
      },
      (e: unknown) => {
        if (here) setNotice(errorMessage(e));
      },
    );
    return () => {
      here = false;
    };
    // The frames are the whole of what the range depends on, so they are the whole of the key: the
    // rest of the order is read at the moment the question is asked, and asking again because the
    // length moved would be asking what the length may be with that length already in the question.
  }, [token, id, going]);

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

  /** Nothing said is the api's own answer, clamped — the figure on the card until a finger moves it. */
  const seconds = order.seconds ?? preview?.target_seconds ?? null;
  const template = order.template;

  return (
    <WizardStep
      step={4}
      title={s.montage.buildTitle}
      notice={notice}
      action={
        <Button
          variant="primary"
          wide
          trailingIcon={ChevronRight}
          label={s.montage.toSummary}
          busy={busy}
          onPress={() => void submit()}
        />
      }
    >
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text role="eyebrow" accessibilityRole="header" style={styles.grow}>
              {s.montage.howLong.toUpperCase()}
            </Text>
            {preview ? (
              <Text role="meta" tone="faint">
                {s.montage.lengthUpTo(formatRuntime(preview.max_seconds) ?? '')}
              </Text>
            ) : null}
          </View>

          {preview === null || seconds === null ? (
            <Waiting text={s.state.loading} size={26} />
          ) : (
            <LengthSlider
              value={seconds}
              // Any move of it is the length becoming the person's own, which is what takes the
              // template's line out from under the figure.
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
              // Four round answers and «Всё», which is not a number of its own: it is the ceiling
              // the api just named, so it moves with the material like everything else here.
              presets={[
                ...PRESETS.map((value) => ({ label: formatRuntime(value) ?? '', value })),
                { label: s.montage.lengthAll, value: preview.max_seconds },
              ]}
            />
          )}
        </View>

        <Segment
          label={s.montage.shape}
          wide
          options={ORIENTATIONS.map((way) => ({ value: way, label: s.montage.orientation[way] }))}
          value={order.orientation}
          onChange={(orientation) => change({ orientation })}
        />
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
    block: { gap: space.s2 },
    // The heading and the ceiling share a baseline, the way every pair of them in the layout does.
    blockHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
  }),
);
