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
 * The last step of the walk and not the end of it: what follows is the summary (`MontageSummary`),
 * which is where the order is actually sent, so the button here only leads on. Nothing has left
 * the phone by this point except a track somebody sent up themselves — and this question, which
 * writes nothing at all.
 */
export default function BuildStep() {
  const router = useRouter();
  const s = useStrings();
  const { token } = useAuth();
  const { id, items, reread, material, order, change } = useOrder();
  const styles = useStyles();
  /** The range could not be asked for — said in place of the slider, with the way to ask again. */
  const [failed, setFailed] = useState<string | null>(null);
  /** What the api says this order comes to. Null until it has answered — there is no guess here. */
  const [preview, setPreview] = useState<MontagePreview | null>(null);
  /** The frames going in, as one word: the range is worked out from exactly these and nothing else. */
  const going = taken(material, order)
    .map((item) => item.id)
    .join(',');

  useEffect(() => {
    if (!token || items === null) return;
    let here = true;
    // The old answer goes with the question: a range standing while the new one is asked is a
    // range the order may already have been refused for.
    setPreview(null);
    setFailed(null);
    previewMontage(token, id, {
      ...wishes(items, order),
      // The question is what the material can carry, so the length is left out of it: asked with
      // one the frames no longer stretch to, the api answers 400 instead of the new range.
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
    // The frames, as read, are the whole of what the range depends on, so they are the whole of the
    // key: a new read of the material asks again even when the same frames came back, because the
    // same frames can carry less than they did. The rest of the order is read at the moment the
    // question is asked, and asking again because the length moved would be asking what the length
    // may be with that length already in the question.
  }, [token, id, items, going]);

  /**
   * A length standing outside what the api just named comes back inside it. Two ways in: the
   * material shrank under a figure already chosen — walking back to step 1 and dropping half the
   * frames is all it takes — and the autopilot, which rides the figure up to the template's own
   * while this answer is still in flight. Watched rather than done once on arrival, so whichever
   * of the two moves last is the one that is held: a figure the order would be refused for must
   * not be left standing until the summary says so.
   */
  useEffect(() => {
    if (preview === null || order.seconds === null) return;
    const held = Math.min(Math.max(order.seconds, preview.min_seconds), preview.max_seconds);
    if (held !== order.seconds) change({ seconds: held });
  }, [preview, order.seconds, change]);

  /** Nothing said is the api's own answer, clamped — the figure on the card until a finger moves it. */
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
            <Text role="meta" tone="faint">
              {s.montage.lengthUpTo(formatRuntime(preview.max_seconds) ?? '')}
            </Text>
          ) : null}
        </View>

        {failed !== null ? (
          // Asked again off a fresh read of the material, not with the same body: a frame the
          // body still names may be the very reason it was refused.
          <Banner tone="error" text={failed}>
            <Button size="xs" variant="quiet" label={s.action.retry} onPress={reread} />
          </Banner>
        ) : preview === null || seconds === null ? (
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
        options={ORIENTATIONS.map((way) => ({ value: way, label: s.montage.orientation[way] }))}
        value={order.orientation}
        onChange={(orientation) => change({ orientation })}
      />
    </WizardStep>
  );
}

/** Both ways up, in the order the layout draws them. */
const ORIENTATIONS: readonly MontageOrientation[] = ['landscape', 'portrait'];

const useStyles = themed(() =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    body: {
      flexGrow: 1,
      paddingHorizontal: space.s4,
      paddingTop: wizardLead.title,
      paddingBottom: space.s6,
      // The layout's own: the block of the length ends at 399 and «ФОРМАТ» stands at 417.
      gap: 18,
    },
    block: { gap: space.s2 },
    // The heading and the ceiling share a baseline, the way every pair of them in the layout does.
    blockHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
  }),
);
