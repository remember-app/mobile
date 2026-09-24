import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, listContacts, memberHandle, memberName, type Contact } from '@/api';
import { useAuth } from '@/lib/auth';
import {
  AppBar,
  Avatar,
  AvatarStack,
  Banner,
  Board,
  Button,
  IconButton,
  RowSection,
  Segment,
  Text,
} from '@/kit';
import { setLanguage, useLanguage, useStrings } from '@/lib/language';
import { board, setTheme, space, themed, useThemeChoice } from '@/theme';

/**
 * `Account` (spec 8, «Аккаунт и контакты»): who you are here, what the app is set to, and the way
 * out. Four blocks down the body with one hairline under the first and one over the last — the rules
 * are what say «this is you», «this is the app», «this is leaving», and the group in the middle keeps
 * its air on purpose: the product has exactly two settings and a screen that admits it is better than
 * one padded out with rows leading nowhere.
 *
 * «Контакты» is a section row here and nowhere else (doc-10): the one way into the list, instead of a
 * second icon in the main screen's bar.
 *
 * The name is shown and not editable (TASK-113): the username is claimed once on /set-username and
 * the api still takes a change, but this screen offers none.
 */
export default function ProfileScreen() {
  const { token, user, signOut } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const theme = useThemeChoice();
  const language = useLanguage();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The roster's own rule for what a person is called, turned on yourself: the name if there is one,
  // else the username. So the line under it drops the username when that is already what is written
  // above — printing it twice says nothing the second time.
  const name = memberName(user);

  /**
   * The count and the three faces on the «Контакты» row, refreshed on the way back from the list
   * itself. A failure here is swallowed: this row is a sign of what is behind it, not the list, and
   * the screen behind it says for itself when it cannot be read.
   */
  useFocusEffect(
    useCallback(() => {
      if (token) listContacts(token).then(setContacts, () => {});
    }, [token]),
  );

  /**
   * A pick is already on the screen by the time this is called — the stores turn the app first and
   * only then reach for the keychain. So there is nothing to wait for and nothing to undo; a
   * keychain that refuses costs the app its memory of the pick, and that is worth saying out loud
   * rather than swallowing.
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
    <Board>
      <AppBar
        title={s.profile.title}
        left={
          <IconButton
            icon={ChevronLeft}
            label={s.action.back}
            // Same as everywhere else: nothing behind means home, never a button that answers
            // nothing.
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        }
      />

      <ScrollView
        // The spec's body ends 30 clear of the bottom; on a phone the home indicator is what that has
        // to clear, and it is the taller of the two.
        contentContainerStyle={[
          styles.body,
          { paddingBottom: Math.max(insets.bottom, board.bottom) },
        ]}
      >
        {/* «Кто вы»: the 68 circle, the name in full voice, and under it the username and the
            address. Composition rather than a part of the library — nothing else in the product
            stands anybody at this size. A long name and a long address each cut with an ellipsis
            rather than wrapping, so the circle never moves. */}
        <View style={styles.who}>
          <Avatar name={name} size={68} />
          <View style={styles.whoWords}>
            <Text role="sheetTitleSm" numberOfLines={1}>
              {name}
            </Text>
            <Text role="label" numberOfLines={1}>
              {memberHandle(user)}
            </Text>
            {user?.email ? (
              <Text role="meta" numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Over the switches and not at the foot of the screen: this is the answer to the pick that
            was just made, and the spec stands it where the pick was. */}
        {error ? <Banner tone="error" text={error} /> : null}

        {/* The one door to the contact list. The stack and the count are what it is worth opening
            for — with nobody saved yet there is neither, and the row still leads there, because an
            empty list is where the first name is typed. */}
        <RowSection
          title={s.contacts.title}
          meta={contacts.length > 0 ? s.profile.contactsMeta(contacts.length) : undefined}
          sign={
            contacts.length > 0 ? <AvatarStack names={contacts.map(memberName)} /> : undefined
          }
          onPress={() => router.push('/contacts')}
        />

        {/* «Что настроить», and under each switch the line saying where it reaches: the theme no
            further than this screen, the language as far as the mails and the pushes. Three values
            against two: the theme can be handed back to the phone, the language cannot — a phone in
            German is not one of the two languages this app speaks, so there is nothing to hand back
            to (doc-8).

            Only the language row is `wide`: a third of a phone's column is 97pt of word and «Как в
            телефоне» is 108, so equal thirds would cut it on every phone in service — measured, not
            guessed. The spec's own floor is that every word stays whole at full size, and it outranks
            the geometry; sized to its words the theme row comes out 308 of the 358 there are anyway,
            so the two rows read as a pair regardless. */}
        <Segment
          label={s.theme.label}
          hint={s.theme.hint}
          value={theme}
          onChange={(next) => remember(setTheme(next))}
          options={[
            { value: 'system', label: s.theme.system },
            { value: 'dark', label: s.theme.dark },
            { value: 'light', label: s.theme.light },
          ]}
        />

        <Segment
          label={s.language.label}
          hint={s.language.hint}
          wide
          value={language}
          onChange={(next) => remember(setLanguage(next))}
          // Each language names itself, in itself: whoever is looking for their own reads it in the
          // one they know, whichever set the app is currently in.
          options={[
            { value: 'ru', label: s.language.ru },
            { value: 'en', label: s.language.en },
          ]}
        />

        {/* «Как уйти» (spec 8): the dangerous 60, alone under the second hairline at the bottom of
            the body — «Выход стоит внизу и один, чтобы не попасть в него по дороге». Nothing is
            written under it: the button says what it does, and the spec leaves the question after the
            press undrawn rather than answering it with a line. */}
        <View style={styles.out}>
          <Button variant="danger" size="xl" label={s.action.logOut} busy={busy} onPress={logOut} />
        </View>
      </ScrollView>
    </Board>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Spec 8 says it once for every screen: «Боковой отступ 16 задаёт экран». `flexGrow` rather than
    // `flex` so the column is at least the height of the screen — that is what gives the way out
    // something to be pushed against — and taller than it once the content is, which is when it
    // scrolls.
    body: { flexGrow: 1, gap: space.s6, paddingHorizontal: space.s4 },
    who: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      paddingBottom: space.s5,
      borderBottomWidth: 1,
      borderBottomColor: color.line,
    },
    whoWords: { flex: 1, minWidth: 0, gap: space.s1 },
    // The way out and its rule stand at the bottom of the body whatever is above them.
    out: {
      marginTop: 'auto',
      paddingTop: space.s5,
      borderTopWidth: 1,
      borderTopColor: color.line,
    },
  }),
);
