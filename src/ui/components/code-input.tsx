import { type Ref, useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CodeField, type FieldState, type TextInputRef } from '@/ui/kit/field';

export type CodeOutcome = 'ok' | 'error';

type Props = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  outcome: CodeOutcome | null;
  state?: FieldState;
  onSettled: (outcome: CodeOutcome) => void;
  length?: number;
  alnum?: boolean;
  autoFocus?: boolean;
  inputRef?: Ref<TextInputRef>;
};

export function CodeInput({ outcome, state, onSettled, ...field }: Props) {
  const lift = useSharedValue(0);
  const shake = useSharedValue(0);
  const handled = useRef<CodeOutcome | null>(null);
  const settled = useRef(onSettled);
  settled.current = onSettled;

  useEffect(() => {
    if (!outcome) {
      handled.current = null;
      return;
    }
    if (handled.current === outcome) return;
    handled.current = outcome;

    if (outcome === 'ok') {
      lift.value = withSequence(
        withTiming(-12, { duration: 110 }),
        withSpring(0, { damping: 9, stiffness: 200, mass: 0.6 }),
      );
    } else {
      shake.value = withSequence(
        withTiming(-10, { duration: 65 }),
        withTiming(10, { duration: 80 }),
        withTiming(-7, { duration: 80 }),
        withTiming(7, { duration: 80 }),
        withTiming(0, { duration: 80 }),
      );
    }

    const timer = setTimeout(() => settled.current(outcome), outcome === 'ok' ? 450 : 700);
    return () => clearTimeout(timer);
  }, [outcome, lift, shake]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { translateY: lift.value }],
  }));

  return (
    <Animated.View style={style}>
      <CodeField {...field} state={state ?? outcome ?? undefined} />
    </Animated.View>
  );
}
