import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/ui/theme';

export function useKeyboardGap() {
  const insets = useSafeAreaInsets();
  return { closed: -insets.bottom, opened: -space.s2 };
}

export function KeyboardBar({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const offset = useKeyboardGap();
  return (
    <KeyboardStickyView offset={offset} style={style}>
      {children}
    </KeyboardStickyView>
  );
}
