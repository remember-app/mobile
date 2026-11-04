import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Contact, listContacts, memberHandle, memberName } from '@/api';
import {
  AppBar,
  Avatar,
  AvatarStack,
  BackButton,
  Banner,
  Board,
  Button,
  ConfirmSheet,
  DRAWN,
  IconButton,
  RowSection,
  RowToggle,
  Segment,
  Sheet,
  Text,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { type Failure, failure } from '@/lib/failure';
import { setLanguage, useLanguage, useStrings } from '@/lib/language';
import { UsernameForm } from '@/screens/onboarding/username-form';
import { board, height, radius, setTheme, space, themed, useThemeChoice } from '@/theme';
export default function ProfileScreen() {
  const { token, user, signOut, datesBetweenDays, setDatesBetweenDays } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const theme = useThemeChoice();
  const language = useLanguage();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const name = memberName(user);
  const handle = memberHandle(user);
  useFocusEffect(
    useCallback(() => {
      if (token) listContacts(token).then(setContacts, () => {});
    }, [token]),
  );
  function remember(stored: Promise<void>) {
    setError(null);
    stored.catch((e) => setError(failure(e)));
  }
  async function logOut() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (e) {
      setError(failure(e));
      setBusy(false);
    }
  }
  return (
    <Board
      bar={
        <AppBar
          title={s.profile.title}
          left={
            <BackButton
              label={s.action.back}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          }
        />
      }
      body={[styles.body, { paddingBottom: Math.max(insets.bottom, board.bottom) }]}
    >
      <View style={styles.card}>
        <Avatar name={name} size={64} display />
        <View style={styles.cardWords}>
          <Text role="title">{name}</Text>
          {handle ? (
            <Text role="label" fit>
              {handle}
            </Text>
          ) : null}
          {user?.email ? (
            <Text role="meta" fit>
              {user.email}
            </Text>
          ) : null}
        </View>
        <IconButton
          icon={DRAWN.pen}
          glyph={{ size: 17, stroke: 1.8 }}
          label={s.profile.edit}
          tone="raise"
          onPress={() => setRenaming(true)}
        />
      </View>

      {error ? <Banner tone="error" failure={error} /> : null}

      <RowSection
        heading={s.contacts.title}
        title={contacts.length > 0 ? s.memory.people(contacts.length) : s.profile.contactsMeta}
        meta={contacts.length > 0 ? s.profile.contactsMeta : undefined}
        sign={contacts.length > 0 ? <AvatarStack names={contacts.map(memberName)} /> : undefined}
        onPress={() => router.push('/contacts')}
      />

      <View style={styles.pair}>
        <View style={styles.setting}>
          <Heading>{s.theme.label}</Heading>
          <Segment
            label={s.theme.label}
            hideLabel
            small
            value={theme}
            onChange={(next) => remember(setTheme(next))}
            options={[
              { value: 'system', label: s.theme.system },
              { value: 'dark', label: s.theme.dark },
              { value: 'light', label: s.theme.light },
            ]}
          />
        </View>
        <View style={styles.setting}>
          <Heading>{s.language.label}</Heading>
          <Segment
            label={s.language.label}
            hideLabel
            value={language}
            onChange={(next) => remember(setLanguage(next))}
            options={[
              { value: 'ru', label: s.language.ru },
              { value: 'en', label: s.language.en },
            ]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Heading>{s.profile.gallery}</Heading>
        <RowToggle
          label={s.profile.datesBetweenDays}
          value={datesBetweenDays}
          onValueChange={(on) => remember(setDatesBetweenDays(on))}
        />
      </View>

      <View style={styles.out}>
        <Button
          variant="danger"
          size="xl"
          labelRole="controlLg"
          label={s.action.logOut}
          busy={busy}
          onPress={() => setLeaving(true)}
        />
      </View>

      <Sheet visible={renaming} onCancel={() => setRenaming(false)} title={s.profile.edit}>
        <UsernameForm submitLabel={s.action.save} onClaimed={() => setRenaming(false)} />
      </Sheet>

      <ConfirmSheet
        visible={leaving}
        variant="gentle"
        title={s.profile.logOutAsk}
        text={s.profile.logOutText}
        confirmLabel={s.profile.logOutDo}
        cancelLabel={s.profile.stay}
        onConfirm={() => {
          setLeaving(false);
          void logOut();
        }}
        onCancel={() => setLeaving(false)}
      />
    </Board>
  );
}
function Heading({ children }: { children: string }) {
  return (
    <Text role="eyebrow" tone="muted" accessibilityRole="header">
      {children.toUpperCase()}
    </Text>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    body: {
      flexGrow: 1,
      gap: 26,
      paddingTop: board.bodyAccount - board.status - height.bar,
      paddingHorizontal: space.s4,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: space.s4,
      borderRadius: radius.cover,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
    cardWords: { flex: 1, minWidth: 0, gap: space.s1 },
    pair: { gap: 18 },
    setting: { gap: space.s2 },
    section: { gap: 10 },
    out: { marginTop: 'auto' },
  }),
);
