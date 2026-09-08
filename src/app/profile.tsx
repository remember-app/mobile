import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, memberHandle, memberName } from '@/api';
import { useAuth } from '@/auth';
import { AppBar, Banner, Button, Hint, IconButton, MemberHead, Segment } from '@/kit';
import { setLanguage, useLanguage, useStrings } from '@/language';
import { setTheme, space, themed, useThemeChoice } from '@/theme';

/**
 * The account: who you are here, how the app is set, and the way out.
 *
 * The kit's screen 8 cuts the screen into three with two hairlines — «кто вы», «что настроить», «как
 * уйти» — and this file is those three in order. The middle one keeps its air on purpose: the product
 * has exactly two settings, and a screen that admits it is better than one padded out with rows that
 * lead nowhere.
 *
 * The name is shown and not editable (TASK-113): the username is claimed once on /set-username and
 * the api still takes a change, but this screen offers none.
 *
 * Neither doc-8 nor doc-9 gets a settings screen of its own — there are two things to set in the
 * whole product, and this is the screen that is already about the person rather than about a memory.
 */
export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const theme = useThemeChoice();
  const language = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The roster's own rule for what a person is called, turned on yourself: the name if there is one,
  // else the username. So the line under it drops the username when that is already what is written
  // above — printing it twice says nothing the second time.
  const name = memberName(user);

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
    // No native header anywhere in the app, so the screen keeps itself out from under the status bar.
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* The kit's three belts: the head does not move, the body scrolls under it. */}
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
        // The kit's `.screen__body` ends 20 clear of the bottom; on a phone the home indicator is
        // what that has to clear, and it is the taller of the two.
        contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, space.s5) }]}
      >
        {/* «Кто вы»: the kit's member row turned on yourself — the big circle, the name in full
            voice, and under it the username and the address. The hairline belongs to the row. */}
        <MemberHead name={name} username={memberHandle(user)} email={user?.email ?? undefined} />

        {/* Over the switches and not at the foot of the screen: this is the answer to the pick that
            was just made, and the kit stands it where the pick was («Ждём», screen 8). */}
        {error ? <Banner tone="error" text={error} /> : null}

        {/* «Что настроить», and under each switch the line saying where it reaches: the theme no
            further than this screen, the language as far as the mails and the pushes. Three values
            against two: the theme can be handed back to the phone, the language cannot — a phone in
            German is not one of the two languages this app speaks, so there is nothing to hand back
            to (doc-8).

            The kit draws both rows on `.segment-wide`, and only the language one is: a third of a
            phone's column is 97pt of word and «Как в телефоне» is 108, so equal thirds would cut it
            on every phone in service — measured, not guessed. The kit's own floor is that every word
            stays whole at full size, and it outranks the geometry; sized to its words the theme row
            comes out 308 of the 358 there are anyway, so the two rows read as a pair regardless. */}
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

        {/* «Как уйти», under the second hairline and pushed to the bottom of the body: away from the
            things pressed every day, and not in a footer — a footer would say «this is what the
            screen is for», and the screen is for what stands above it.

            The line under the button names the consequence before the press, and that is why nothing
            asks a second time (kit screen 8): the session comes back with the same sign-in, so it is
            neither the rust colour nor a sheet. Rust in this product stays on what takes frames
            away. */}
        <View style={styles.out}>
          <Button
            variant="quiet"
            sm
            label={s.action.logOut}
            busy={busy}
            onPress={logOut}
            style={styles.outButton}
          />
          <Hint>{s.profile.logOutText}</Hint>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // The kit's `.screen__head` / `.screen__body` / `.screen__foot` all sit 16 in, and the screens
    // section says it once for all eleven: «Боковой отступ 16 задаёт экран».
    screen: { flex: 1, paddingHorizontal: space.s4, backgroundColor: color.ink },
    // `.stack-6`, and `flexGrow` rather than `flex` so the column is at least the height of the
    // screen — that is what gives the group below something to be pushed against — and taller than
    // it once the content is, which is when it scrolls.
    body: { flexGrow: 1, gap: space.s6 },
    // `.stack-2.push` with the kit's second hairline over it: the way out and its line stand at the
    // bottom of the body, the rule 20 above them.
    out: {
      marginTop: 'auto',
      gap: space.s2,
      paddingTop: space.s5,
      borderTopWidth: 1,
      borderTopColor: color.line,
    },
    // `align-self:flex-start` — the button is no wider than its own words; the line under it takes
    // the column.
    outButton: { alignSelf: 'flex-start' },
  }),
);
