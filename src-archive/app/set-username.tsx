import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ActionBar, Banner, Board } from '@/kit';
import { useStrings } from '@/lib/language';
import { OnboardingHead } from '@/screens/onboarding/head';
import { UsernameButton, UsernameField, useUsername } from '@/screens/onboarding/username-form';
import { space } from '@/theme';
export default function SetUsernameScreen() {
  const router = useRouter();
  const s = useStrings();
  const name = useUsername({ onConsentNeeded: () => router.replace('/consent') });
  return (
    <Board
      footer={
        <ActionBar keyboardGap={space.s4}>
          <View style={styles.column}>
            {name.failed ? <Banner tone="error" failure={name.failed} /> : null}
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
