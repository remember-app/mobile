import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Contact, errorMessage, listContacts, memberHandle, memberName } from '@/api';
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
import { setLanguage, useLanguage, useStrings } from '@/lib/language';
import { UsernameForm } from '@/screens/onboarding/username-form';
import { board, height, radius, setTheme, space, themed, useThemeChoice } from '@/theme';

/**
 * `Account` (spec 8, «Аккаунт и контакты»): the person first, on a card of their own; then the way
 * into the contact list, the theme and the language, the one setting every feed shares, and at the
 * foot, apart from the rest, the way out.
 *
 * The pencil on the card changes the username and nothing else — the product keeps no name and no
 * picture of its own (doc-04), and the address is the one the person signs in with. It opens the one
 * username form there is on a sheet over this screen, rather than sending the person to
 * /set-username: that screen is the last step of the way in, and the gate declares it only while an
 * account has no name at all.
 */
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
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // The roster's own rule for what a person is called, turned on yourself: the name if there is one,
  // else the username — and the `@` line under it only when it says something the name does not.
  const name = memberName(user);
  const handle = memberHandle(user);

  /**
   * The count and the faces on the «Контакты» card, refreshed on the way back from the list itself.
   * A failure here is swallowed: the card is a sign of what is behind it, not the list, and the
   * screen behind it says for itself when it cannot be read.
   */
  useFocusEffect(
    useCallback(() => {
      if (token) listContacts(token).then(setContacts, () => {});
    }, [token]),
  );

  /**
   * Every setting here is on the screen before it is kept: the theme and the language turn the app
   * first and reach for the keychain after, and «Даты между днями» turns every feed at once and is
   * turned back by the provider if the api refuses it. So there is nothing to wait for and nothing to
   * undo here — only a refusal to say out loud rather than swallow.
   */
  function remember(stored: Promise<void>) {
    setError(null);
    stored.catch((e) => setError(errorMessage(e)));
  }

  async function logOut() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
    // On success the gate swaps this screen out, so nothing to reset.
  }

  return (
    // No native header anywhere in the app, so the board keeps itself out from under the status bar.
    <Board
      bar={
        <AppBar
          title={s.profile.title}
          left={
            <BackButton
              label={s.action.back}
              // Same as everywhere else: nothing behind means home, never a button that answers
              // nothing.
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          }
        />
      }
      // The spec's way out stands 30 clear of the bottom; on a phone the home indicator is what
      // that has to clear, and it is the taller of the two.
      body={[styles.body, { paddingBottom: Math.max(insets.bottom, board.bottom) }]}
    >
      {/* The profile card. A long name and a long address each cut with an ellipsis rather than
          wrapping, so neither the circle nor the pencil ever moves. */}
      <View style={styles.card}>
        <Avatar name={name} size={64} display />
        <View style={styles.cardWords}>
          <Text role="title" numberOfLines={1}>
            {name}
          </Text>
          {handle ? (
            <Text role="label" numberOfLines={1}>
              {handle}
            </Text>
          ) : null}
          {user?.email ? (
            <Text role="meta" numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>
        <IconButton
          icon={DRAWN.pen}
          // Spec 8, `Account`: the pen 17 at 1.8.
          glyph={{ size: 17, stroke: 1.8 }}
          label={s.profile.edit}
          tone="raise"
          onPress={() => setRenaming(true)}
        />
      </View>

      {/* Over the settings and not at the foot of the screen: it answers a pick that was just
          made, or the way out that was just tried. */}
      {error ? <Banner tone="error" text={error} /> : null}

      {/* The one door to the contact list. The count and the faces are what it is worth opening
          for; with nobody saved yet — or the list not read — there is neither, the card says what
          it is for instead, and it still leads there, because an empty list is where the first
          name is typed. */}
      <RowSection
        heading={s.contacts.title}
        title={contacts.length > 0 ? s.memory.people(contacts.length) : s.profile.contactsMeta}
        meta={contacts.length > 0 ? s.profile.contactsMeta : undefined}
        sign={contacts.length > 0 ? <AvatarStack names={contacts.map(memberName)} /> : undefined}
        onPress={() => router.push('/contacts')}
      />

      {/* Three values against two: the theme can be handed back to the phone, the language
          cannot — a phone in German is not one of the two languages this app speaks (doc-8).
          Nothing under either: the change shows itself. */}
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
            // Each language names itself, in itself: whoever is looking for their own reads it in
            // the one they know, whichever set the app is currently in.
            options={[
              { value: 'ru', label: s.language.ru },
              { value: 'en', label: s.language.en },
            ]}
          />
        </View>
      </View>

      {/* The person's own setting for every feed of every memory: on, the day is written between
          the strips (`MemoryDated`); off, it is read off the spine while the feed moves. */}
      <View style={styles.section}>
        <Heading>{s.profile.gallery}</Heading>
        <RowToggle
          label={s.profile.datesBetweenDays}
          value={datesBetweenDays}
          onValueChange={(on) => remember(setDatesBetweenDays(on))}
        />
      </View>

      {/* Apart from the body and with no rule over it: leaving is not something this screen does
          but the way out of it. Pushed to the foot whatever stands above it. */}
      <View style={styles.out}>
        <Button
          variant="danger"
          size="xl"
          // `Account.json`: the one 60 carries its words a size up, 17 / 600.
          labelRole="controlLg"
          label={s.action.logOut}
          busy={busy}
          onPress={() => setLeaving(true)}
        />
      </View>

      <Sheet visible={renaming} onCancel={() => setRenaming(false)} title={s.profile.edit}>
        <UsernameForm submitLabel={s.action.save} onClaimed={() => setRenaming(false)} />
      </Sheet>

      {/* Asked, though nothing is lost — so the gentle kind: `paper` and a quiet way back, no red. */}
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

/** The heading over a block of the body, in the caps the layout writes it in. */
function Heading({ children }: { children: string }) {
  return (
    <Text role="eyebrow" tone="muted" accessibilityRole="header">
      {children.toUpperCase()}
    </Text>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Spec 8: the body of `Account` starts at 132 — 36 under the bar — with 16 at the sides and 26
    // between the blocks. `flexGrow` rather than `flex`, so the column is at least the height of the
    // screen — that is what gives the way out something to be pushed against — and taller than it
    // once the content is, which is when it scrolls.
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
    // «Тема» and «Язык» read as a pair: 18 between them, 8 under each heading.
    pair: { gap: 18 },
    setting: { gap: space.s2 },
    section: { gap: 10 },
    out: { marginTop: 'auto' },
  }),
);
