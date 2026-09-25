import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActionBar, Board } from '@/kit';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import { UsernameForm } from '@/screens/onboarding/username-form';
import { space } from '@/theme';

/**
 * `Username` — the last screen of the way in (spec 8), and the only screen a signed-in account
 * without a username can reach. The head is the one `Login` had, in the same place: the person has
 * not moved anywhere, they are still coming in.
 *
 * What happens after the name is claimed belongs to the gate in `_layout`, which stops declaring
 * this screen the moment the account has one — and to `invite.tsx`, which is where somebody who
 * arrived by a link is carried into the memory rather than onto the main screen.
 */
export default function SetUsernameScreen() {
  const router = useRouter();
  const s = useStrings();

  return (
    <Board
      footer={
        <ActionBar>
          <View style={styles.column}>
            <UsernameForm
              submitLabel={s.username.continue}
              // The agreement is the api's gate on registering, and this is the screen behind it:
              // whoever got here without accepting is sent to accept rather than shown a refusal.
              onConsentNeeded={() => router.replace('/consent')}
            />
          </View>
        </ActionBar>
      }
    >
      <OnboardingHead />
    </Board>
  );
}

// The room between the head and the field is the body's own: the head stays where the three screens
// before it had it, and everything that changes happens at the bottom edge.
const styles = StyleSheet.create({
  column: { flex: 1, gap: space.s3 },
});
