import { useRouter } from 'expo-router';
import { Image as ImageIcon, Shield, Smile } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { acceptConsent, errorMessage } from '@/api';
import {
  ActionBar,
  Banner,
  Board,
  Button,
  Divider,
  ICO_S,
  ICO_XS,
  Icon,
  type IconComponent,
  Sheet,
  Text,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import { font, radius, space, themed, useTheme } from '@/theme';

/**
 * `Consent` — the agreement, step 4 of the way in (spec 8, doc-04, decision-9). The one thing that has
 * to happen before a person may register: the step's head, and the card of three promises standing
 * from the bottom edge with the button under it. No field here, so the keyboard never comes up.
 *
 * There is no decline button. Declining is walking away from the screen, and the line under the
 * main action says so out loud rather than dressing the refusal up as a second choice. «Назад» is that
 * walk: the address and the code behind this step are spent, and the session they bought is not
 * wanted without the agreement — so it ends, and the gate stands the way in from its first step.
 */
export default function ConsentScreen() {
  const { token, signOut } = useAuth();
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
      // Pushed, so the name's «Назад» comes back here.
      router.push('/set-username');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Board
      footer={
        <ActionBar>
          <View style={styles.column}>
            <View style={styles.card}>
              <Line icon={ImageIcon}>
                <Text role="bodyXs" tone="muted" style={styles.grow}>
                  {s.consent.storage}
                </Text>
              </Line>
              <Divider />
              {/* The one line the whole screen is really about, so it is the one that is lit: what
                  the network does with a person's frames is named here and not buried in the sheet
                  below. */}
              <Line lit icon={Smile}>
                <Text role="bodyXs" style={[styles.grow, styles.medium]}>
                  {s.consent.recognisesBefore}
                  <Text role="bodyXs" style={styles.strong}>
                    {s.consent.recognises}
                  </Text>
                  {s.consent.recognisesAfter}
                </Text>
              </Line>
              <Divider />
              <Line icon={Shield}>
                <Text role="bodyXs" tone="muted" style={styles.grow}>
                  {s.consent.training}
                </Text>
              </Line>
            </View>

            {/* The text itself is one press away and never in the way: three lines are what a
                person actually reads, and the whole of it is what they agree to. */}
            <Button
              variant="link"
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

            <Text role="noteSm" tone="muted" style={styles.note}>
              {s.consent.required}
            </Text>
          </View>
        </ActionBar>
      }
    >
      <OnboardingHead
        step={4}
        back={() => signOut().catch((e: unknown) => setError(errorMessage(e)))}
      />

      <View style={styles.room}>{error ? <Banner tone="error" text={error} /> : null}</View>

      <Sheet
        visible={open}
        onCancel={() => setOpen(false)}
        title={s.consent.agreement.title}
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
        <Icon icon={icon} size={lit ? ICO_XS : ICO_S} color={lit ? color.sparkInk : color.muted} />
      </View>
      {children}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    room: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: space.s4 },
    // Spec 8, `Consent`: the card, the link, «Принимаю» and the line under it stand 14 apart.
    column: { flex: 1, gap: 14 },
    card: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s3, padding: space.s4 },
    lit: { backgroundColor: color.raiseSoft },
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
    // weight lands on the words without breaking the paragraph around them. The lit line is a weight
    // up from the other two, and what it names a weight up again.
    medium: { fontFamily: font.medium },
    strong: { fontFamily: font.bold },
    grow: { flex: 1, minWidth: 0 },
    centre: { alignSelf: 'center' },
    note: { alignSelf: 'center', textAlign: 'center' },
    part: { gap: space.s2 },
  }),
);
