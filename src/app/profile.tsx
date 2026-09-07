import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api';
import { useAuth } from '@/auth';
import { ActionBar, AppBar, Banner, Button, ConfirmSheet, IconButton, RowMember } from '@/kit';
import { useStrings } from '@/language';
import { space, themed } from '@/theme';
import { UsernameForm } from '@/username-form';

/**
 * The account: who you are here, the one thing you can change about it, and the way out.
 *
 * Logging out is asked for on the kit's sheet (section 13) rather than done on the press: from where
 * the person stands the session is gone and only signing in again brings it back, and the kit asks
 * for what cannot be undone the same way it asks about leaving a memory.
 */
export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <View style={styles.body}>
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
        {/* The kit's member row, turned on yourself: the username is what the app calls you by, the
            name is what stands under it. */}
        <RowMember name={user?.username ?? '—'} meta={user?.name ?? s.profile.noName} />

        <UsernameForm submitLabel={s.profile.changeUsername} />

        {error ? <Banner tone="error" text={error} /> : null}
      </View>

      <ActionBar>
        <Button
          variant="danger"
          wide
          label={s.action.logOut}
          busy={busy}
          onPress={() => setAsking(true)}
        />
      </ActionBar>

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
    screen: { flex: 1, paddingHorizontal: space.s6, backgroundColor: color.ink },
    body: { flex: 1, gap: space.s5 },
  }),
);
