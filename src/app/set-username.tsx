import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActionBar, Banner, Board } from '@/kit';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import { UsernameButton, UsernameField, useUsername } from '@/screens/onboarding/username-form';
import { space } from '@/theme';

/**
 * `Username` — the name, step 5 and the last of the way in (spec 8), and the only screen a signed-in
 * account without a username can reach past the agreement. The step's head, the field under it at
 * the head's own place, «Продолжить» at the bottom edge — and the keyboard moves only that.
 *
 * What happens after the name is claimed belongs to the gate in `_layout`, which stops declaring
 * this screen the moment the account has one — and to `invite.tsx`, which is where somebody who
 * arrived by a link is carried into the memory rather than onto the main screen.
 */
export default function SetUsernameScreen() {
  const router = useRouter();
  const s = useStrings();
  // The agreement is the api's gate on registering, and this is the screen behind it: whoever got
  // here without accepting is sent to accept rather than shown a refusal.
  const name = useUsername({ onConsentNeeded: () => router.replace('/consent') });

  return (
    <Board
      footer={
        <ActionBar keyboardGap={space.s4}>
          <View style={styles.column}>
            {name.failed ? <Banner tone="error" text={name.failed} /> : null}
            <UsernameButton name={name} label={s.username.continue} />
          </View>
        </ActionBar>
      }
    >
      <OnboardingHead step={5} back={() => router.back()}>
        <UsernameField name={name} wayIn />
      </OnboardingHead>
    </Board>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, gap: space.s3 },
});
