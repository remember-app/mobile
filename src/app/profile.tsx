import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api';
import { useAuth } from '@/auth';
import { AppBar, Banner, Button, ConfirmSheet, IconButton, RowMember, Segment } from '@/kit';
import { setLanguage, useLanguage, useStrings } from '@/language';
import { setTheme, space, themed, useThemeChoice } from '@/theme';
import { UsernameForm } from '@/username-form';

/**
 * The account: who you are here, the one thing you can change about it, and the way out.
 *
 * Logging out is asked for on the kit's sheet (section 13) rather than done on the press: from where
 * the person stands the session ends and the way back is a whole sign-in, which is worth one
 * question. The button itself is not painted in the rust that colour is held for — that is for what
 * cannot be undone, and this can — and it does not stand in an actionbar either: the kit's screen 8
 * ends the scrolling body with a quiet small button on `.push`, no footer hairline over it. A
 * footer would say «this is what the screen is for», and the screen is for the four things above it.
 *
 * The theme and the language stand here too, on the kit's switch of section 15. Neither doc-8 nor
 * doc-9 gets a settings screen of its own — there are two things to set in the whole product, and
 * this is the screen that is already about the person rather than about a memory.
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
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setAsking(false);
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
        // The field lives in here, so a press on a button has to land while the keyboard is up
        // instead of being spent closing it.
        keyboardShouldPersistTaps="handled"
        // The kit's `.screen__body` ends 20 clear of the bottom; on a phone the home indicator is
        // what that has to clear, and it is the taller of the two.
        contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, space.s5) }]}
      >
        {/* The kit's member row, turned on yourself: the username is what the app calls you by, the
            name is what stands under it. */}
        <RowMember name={user?.username ?? '—'} meta={user?.name ?? s.profile.noName} />

        <UsernameForm submitLabel={s.profile.changeUsername} />

        {/* The kit stands these two side by side, theme first. Three values against two: the theme
            can be handed back to the phone, the language cannot — a phone in German is not one of
            the two languages this app speaks, so there is nothing to hand back to (doc-8). */}
        <Segment
          label={s.theme.label}
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
          value={language}
          onChange={(next) => remember(setLanguage(next))}
          // Each language names itself, in itself: whoever is looking for their own reads it in the
          // one they know, whichever set the app is currently in.
          options={[
            { value: 'ru', label: s.language.ru },
            { value: 'en', label: s.language.en },
          ]}
        />

        {error ? <Banner tone="error" text={error} /> : null}

        <Button
          // Not the kit's rust: that colour is held for what cannot be undone (section 2), and
          // signing in again brings the session back. The question is still asked on the sheet.
          variant="quiet"
          sm
          label={s.action.logOut}
          busy={busy}
          onPress={() => setAsking(true)}
          style={styles.out}
        />
      </ScrollView>

      <ConfirmSheet
        visible={asking}
        title={s.profile.logOutAsk}
        text={s.profile.logOutText}
        confirmLabel={s.action.logOut}
        cancelLabel={s.profile.stay}
        onConfirm={logOut}
        onCancel={() => setAsking(false)}
      />
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // The kit's `.screen__head` / `.screen__body` / `.screen__foot` all sit 16 in, and the screens
    // section says it once for all eleven: «Боковой отступ 16 задаёт экран».
    screen: { flex: 1, paddingHorizontal: space.s4, backgroundColor: color.ink },
    // `.stack-6`, and `flexGrow` rather than `flex` so the column is at least the height of the
    // screen — that is what gives the button below something to be pushed against — and taller than
    // it once the content is, which is when it scrolls.
    body: { flexGrow: 1, gap: space.s6 },
    // The kit's `.push` + `align-self:flex-start`: the way out sits at the bottom of the body, no
    // wider than its own words.
    out: { marginTop: 'auto', alignSelf: 'flex-start' },
  }),
);
