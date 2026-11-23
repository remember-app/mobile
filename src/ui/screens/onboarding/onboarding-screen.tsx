import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Apple, Mail } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { loadSystemMedia } from '@/functionality';
import { useSystemMedia } from '@/ui/hooks';
import { Button } from '@/ui/kit/controls/button';
import { Text } from '@/ui/kit/primitives/text';
import { radius, space, useTheme } from '@/ui/theme';

const SLIDE_MS = 6000;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const step = useSharedValue(0);
  const media = useSystemMedia();
  const slides = media.filter((item) => item.name.startsWith('onboarding-'));
  const slide = slides.length > 0 ? slides[index % slides.length] : undefined;

  const cardTop = insets.top + space.s4;
  const cardLeft = space.s5;
  const cardWidth = width - cardLeft * 2;
  const cardHeight = Math.min(height * 0.32, 280);
  const actionHeight = 112 + insets.bottom;
  const keyboardHeight = Math.min(height * 0.34, 300);

  const go = useCallback(
    (next: number) => {
      step.value = withTiming(Math.max(0, Math.min(2, next)), {
        duration: 380,
        easing: Easing.out(Easing.cubic),
      });
    },
    [step],
  );

  const gesture = useRef(
    Gesture.Pan()
      .maxPointers(1)
      .onEnd((event) => {
        const current = Math.round(step.value);
        const down = event.translationY > 80 && event.translationY > Math.abs(event.translationX);
        const right = event.translationX > 50 && event.translationX > Math.abs(event.translationY);
        if (down) scheduleOnRN(go, Math.max(0, current - 1));
        else if (current === 0 && right) scheduleOnRN(go, 1);
      }),
  ).current;

  useEffect(() => {
    void loadSystemMedia();
  }, []);

  useEffect(() => {
    if (slides.length === 0) return;
    const rotation = setInterval(() => {
      setIndex((value) => (value + 1) % slides.length);
    }, SLIDE_MS);
    return () => clearInterval(rotation);
  }, [slides.length]);

  const fullStyle = useAnimatedStyle(() => ({
    opacity: interpolate(step.value, [1, 2], [1, 0], Extrapolation.CLAMP),
  }));

  const cardStyle = useAnimatedStyle(() => ({
    top: interpolate(step.value, [0, 1, 2], [0, 0, cardTop], Extrapolation.CLAMP),
    left: interpolate(step.value, [0, 1, 2], [0, 0, cardLeft], Extrapolation.CLAMP),
    width: interpolate(step.value, [0, 1, 2], [width, width, cardWidth], Extrapolation.CLAMP),
    height: interpolate(step.value, [0, 1, 2], [height, height, cardHeight], Extrapolation.CLAMP),
    borderRadius: interpolate(step.value, [0, 1, 2], [0, 0, radius.section], Extrapolation.CLAMP),
    opacity: interpolate(step.value, [1, 2], [0, 1], Extrapolation.CLAMP),
  }));

  const cardBrandStyle = useAnimatedStyle(() => ({
    top: space.s3,
    transform: [
      {
        scale: interpolate(step.value, [1, 2], [1, 0.72], Extrapolation.CLAMP),
      },
    ],
  }));

  const cardScrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(step.value, [1, 2], [1, 0.7], Extrapolation.CLAMP),
  }));

  const actionStyle = useAnimatedStyle(() => ({
    height: interpolate(
      step.value,
      [0, 1, 2],
      [0, actionHeight, actionHeight],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(step.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(step.value, [1, 2], [0, -keyboardHeight], Extrapolation.CLAMP),
      },
    ],
  }));

  const keyboardStyle = useAnimatedStyle(() => ({
    height: interpolate(step.value, [1, 2], [0, keyboardHeight], Extrapolation.CLAMP),
    opacity: interpolate(step.value, [1, 2], [0, 1], Extrapolation.CLAMP),
  }));

  const photoBody = (card: boolean) => (
    <>
      {slide ? (
        <Animated.Image
          key={`${card ? 'card' : 'full'}-${slide.mediaId}`}
          source={{ uri: slide.url }}
          resizeMode="cover"
          entering={FadeIn.duration(1000)}
          exiting={FadeOut.duration(800)}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Animated.View style={[styles.scrim, card ? cardScrimStyle : null]} />
      <Animated.View style={[styles.brand, card ? cardBrandStyle : { top: insets.top + space.s4 }]}>
        <Text role="heroSm" tone="onFill">
          Remember
        </Text>
        <ExpoImage
          source={require('../../../../assets/logo/logo-2048x2048.svg')}
          contentFit="contain"
          style={styles.logo}
        />
      </Animated.View>
    </>
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.root, { backgroundColor: color.ink }]}>
        <StatusBar style="light" />
        <Animated.View style={[styles.fullPhoto, fullStyle]}>{photoBody(false)}</Animated.View>
        <Animated.View style={[styles.cardPhoto, cardStyle]}>{photoBody(true)}</Animated.View>

        <Animated.View style={[styles.action, actionStyle]}>
          <View style={styles.actionInner}>
            <View style={styles.providers}>
              <Button label="Google" variant="secondary" wide={false} style={styles.provider} />
              <Button
                label="Apple"
                variant="secondary"
                icon={Apple}
                wide={false}
                style={styles.provider}
              />
            </View>
            <Button
              label={t('onboarding.welcome.continue')}
              variant="primary"
              icon={Mail}
              onPress={() => go(2)}
            />
          </View>
        </Animated.View>

        <Animated.View style={[styles.keyboard, keyboardStyle]}>
          <View style={styles.handle} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  fullPhoto: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  cardPhoto: {
    position: 'absolute',
    overflow: 'hidden',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(11,11,18,0.26)',
  },
  brand: {
    position: 'absolute',
    left: space.s5,
    right: space.s5,
    alignItems: 'center',
    gap: space.s2,
  },
  logo: {
    width: 80,
    height: 80,
  },
  action: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    zIndex: 2,
  },
  actionInner: {
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
    gap: space.s2,
  },
  providers: {
    flexDirection: 'row',
    gap: space.s2,
  },
  provider: {
    flex: 1,
  },
  keyboard: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    paddingTop: space.s3,
    paddingBottom: space.s4,
    backgroundColor: 'rgba(11,11,18,0.45)',
    zIndex: 1,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
