import MaskedViewBase from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { space, useTheme } from '@/ui/theme';

const MaskedView = MaskedViewBase as unknown as ComponentType<
  ViewProps & { maskElement: ReactElement }
>;

type Props = {
  edge: 'top' | 'bottom';
  children: ReactNode;
  intensity?: number;
  shade?: boolean;
  style?: StyleProp<ViewStyle>;
};

function Fade({ top }: { top: boolean }) {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <LinearGradient id="blurFade" x1="0" y1={top ? '0' : '1'} x2="0" y2={top ? '1' : '0'}>
          <Stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <Stop offset="0.45" stopColor="#ffffff" stopOpacity="1" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#blurFade)" />
    </Svg>
  );
}

export function BlurBar({ edge, children, intensity = 30, shade = true, style }: Props) {
  const insets = useSafeAreaInsets();
  const { color, name } = useTheme();
  const top = edge === 'top';

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.layer,
        top
          ? { top: 0, paddingTop: insets.top, paddingBottom: space.s2 }
          : { bottom: 0, paddingBottom: insets.bottom, paddingTop: space.s2 },
        style,
      ]}
    >
      <MaskedView
        pointerEvents="none"
        style={[
          styles.blur,
          top ? { top: 0, height: insets.top } : { bottom: 0, height: insets.bottom },
        ]}
        maskElement={<Fade top={top} />}
      >
        <BlurView
          intensity={intensity}
          tint={name === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      </MaskedView>
      {shade ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              experimental_backgroundImage: top
                ? `linear-gradient(to bottom, ${color.ink}40, transparent)`
                : `linear-gradient(to top, ${color.ink}40, transparent)`,
            },
          ]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  blur: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
