import { usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StepScale } from '@/kit';
import { useStrings } from '@/lib/language';
import { space } from '@/theme';

import type { Step } from './head';

/** Which step of the way in each of its screens is. */
const STEPS: Record<string, Step> = {
  '/login': 1,
  '/login/email': 2,
  '/login/code': 3,
  '/consent': 4,
  '/set-username': 5,
};

/**
 * The one progress over the whole way in (spec 7.1, detail 75), laid over the navigator rather than
 * drawn by each screen: the screens slide in and out under it while it stays, and so it can move the
 * way spec 6 has it — the next segment filling as a step is walked, Apple and Google filling the
 * second to the fourth in one movement as they skip the address and the code, and «Назад» emptying
 * the step it left rather than snapping. Off the way in it is not there at all.
 */
export function OnboardingProgress() {
  const step = STEPS[usePathname()];
  return step ? <Bar step={step} /> : null;
}

function Bar({ step }: { step: Step }) {
  const insets = useSafeAreaInsets();
  const s = useStrings();

  return (
    // Spec 4: 6 under the status line, in the screen's margins; nothing under it is covered for a
    // finger — «Назад» starts 12 lower.
    <View pointerEvents="none" style={[styles.bar, { top: insets.top + 6 }]}>
      <StepScale tone="paper" steps={5} done={step} label={s.login.step(step)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: space.s4, right: space.s4 },
});
