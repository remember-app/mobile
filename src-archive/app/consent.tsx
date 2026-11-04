import { useRouter } from 'expo-router';
import { Image as ImageIcon, Shield, Smile } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { acceptConsent } from '@/api';
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
import { type Failure, failure } from '@/lib/failure';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import { font, radius, space, themed, useTheme } from '@/theme';
export default function ConsentScreen() {
  const { token, signOut } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [open, setOpen] = useState(false);
  async function accept() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await acceptConsent(token);
      router.push('/set-username');
    } catch (e) {
      setError(failure(e));
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
      <OnboardingHead step={4} back={() => signOut().catch((e: unknown) => setError(failure(e)))} />

      <View style={styles.room}>{error ? <Banner tone="error" failure={error} /> : null}</View>

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
    glyph: { paddingTop: 1 },
    spark: {
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    medium: { fontFamily: font.medium },
    strong: { fontFamily: font.bold },
    grow: { flex: 1, minWidth: 0 },
    centre: { alignSelf: 'center' },
    note: { alignSelf: 'center', textAlign: 'center' },
    part: { gap: space.s2 },
  }),
);
