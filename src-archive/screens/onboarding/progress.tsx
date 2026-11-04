import { usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StepScale } from '@/kit';
import { useStrings } from '@/lib/language';
import { space } from '@/theme';
import type { Step } from './head';

const STEPS: Record<string, Step> = {
  '/login': 1,
  '/login/email': 2,
  '/login/code': 3,
  '/consent': 4,
  '/set-username': 5,
};
export function OnboardingProgress() {
  const step = STEPS[usePathname()];
  return step ? <Bar step={step} /> : null;
}
function Bar({ step }: { step: Step }) {
  const insets = useSafeAreaInsets();
  const s = useStrings();
  return (
    <View pointerEvents="none" style={[styles.bar, { top: insets.top + 6 }]}>
      <StepScale tone="paper" steps={5} done={step} label={s.login.step(step)} />
    </View>
  );
}
const styles = StyleSheet.create({
  bar: { position: 'absolute', left: space.s4, right: space.s4 },
});
