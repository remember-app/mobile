import { useRouter } from 'expo-router';
import { Image as ImageIcon, Shield, Smile } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { acceptConsent, errorMessage } from '@/api';
import { useAuth } from '@/auth';
import {
  ActionBar,
  Banner,
  Board,
  Button,
  Divider,
  Hint,
  ICO_S,
  ICO_XS,
  Icon,
  Sheet,
  Text,
  type IconComponent,
} from '@/kit';
import { useStrings } from '@/language';
import { OnboardingHead } from '@/onboarding-head';
import { font, radius, space, themed, useTheme } from '@/theme';

/**
 * `Consent` — the agreement (spec 8, doc-04, decision-9). The one thing that has to happen before a
 * person may register, and the only onboarding screen whose head is squeezed: the card of three
 * promises has to fit under it.
 *
 * There is no decline button. Declining is walking away from the screen, and the line under the
 * main action says so out loud rather than dressing the refusal up as a second choice.
 */
export default function ConsentScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function accept() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      // Idempotent on the api's side, so a second «Принимаю» — a lost answer, a session picked up
      // again between this screen and the next — costs nothing and moves the moment nowhere.
      await acceptConsent(token);
      // replace, not push: what is behind this screen is the way in, and it has been walked.
      router.replace('/set-username');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Board>
      <OnboardingHead small />

      <View style={styles.room}>{error ? <Banner tone="error" text={error} /> : null}</View>

      <ActionBar>
        <View style={styles.column}>
          <View style={styles.card}>
            {/* Deliberately not the layout's own sentence — see `strings.ts`: there is no deleting
                a memory in this product, so what ends the storing is a frame deleted or the person
                leaving. */}
            <Line icon={ImageIcon}>
              <Text role="note" style={styles.grow}>
                {s.consent.storage}
              </Text>
            </Line>
            <Divider />
            {/* The one line the whole screen is really about, so it is the one that is lit: what
                the network does with a person's frames is named here and not buried in the sheet
                below. */}
            <Line lit icon={Smile}>
              <Text role="note" tone="paper" style={styles.grow}>
                {s.consent.recognisesBefore}
                <Text role="note" tone="paper" style={styles.strong}>
                  {s.consent.recognises}
                </Text>
                {s.consent.recognisesAfter}
              </Text>
            </Line>
            <Divider />
            <Line icon={Shield}>
              <Text role="note" style={styles.grow}>
                {s.consent.training}
              </Text>
            </Line>
          </View>

          {/* The text itself is one press away and never in the way: three lines are what a person
              actually reads, and the whole of it is what they agree to. */}
          <Button
            variant="quiet"
            label={s.consent.readFull}
            onPress={() => setOpen(true)}
            style={styles.centre}
          />

          <Button
            variant="primary"
            wide
            label={s.consent.accept}
            busyLabel={s.consent.accepting}
            onPress={accept}
            busy={busy}
          />

          <Hint tone="faint" style={styles.note}>
            {s.consent.required}
          </Hint>
        </View>
      </ActionBar>

      <Sheet
        visible={open}
        onCancel={() => setOpen(false)}
        title={s.consent.agreement.title}
        scroll
        footer={
          <Button variant="secondary" label={s.action.close} onPress={() => setOpen(false)} />
        }
      >
        <Text role="bodySm">{s.consent.agreement.lead}</Text>
        {s.consent.agreement.parts.map((part) => (
          <View key={part.title} style={styles.part}>
            <Text role="subtitle">{part.title}</Text>
            <Text role="bodySm" tone="muted">
              {part.text}
            </Text>
          </View>
        ))}
        <Text role="bodySm" tone="muted">
          {s.consent.agreement.tail}
        </Text>
      </Sheet>
    </Board>
  );
}

/**
 * One line of the card: a glyph and what it promises. `lit` is the middle one — raised off the card
 * it stands in, with the glyph in a `spark` circle, because it is the promise the product is
 * actually asking for.
 */
function Line({
  icon,
  lit,
  children,
}: {
  icon: IconComponent;
  lit?: boolean;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { color } = useTheme();

  return (
    <View style={[styles.line, lit ? styles.lit : null]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={lit ? styles.spark : styles.glyph}
      >
        <Icon
          icon={icon}
          size={lit ? ICO_XS : ICO_S}
          color={lit ? color.sparkInk : color.muted}
        />
      </View>
      {children}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    room: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: space.s4 },
    column: { flex: 1, gap: space.s3 },
    card: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3, padding: space.s4 },
    // The layout paints this row #1A1A24, which is no token — `raise` is the role it is reaching
    // for («приподнятое над карточкой»), and it is the one that also holds in the day theme.
    lit: { backgroundColor: color.raise },
    // The glyph sits on the first line of the words rather than in the middle of the block.
    glyph: { paddingTop: 1 },
    spark: {
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Only the face: nested text keeps the size and the leading of the line it stands in, so the
    // weight lands on the words without breaking the paragraph around them.
    strong: { fontFamily: font.bold },
    grow: { flex: 1, minWidth: 0 },
    centre: { alignSelf: 'center' },
    note: { alignSelf: 'center', textAlign: 'center' },
    part: { gap: space.s2 },
  }),
);
