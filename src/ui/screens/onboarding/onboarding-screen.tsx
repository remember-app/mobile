import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Apple, Mail } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedKeyboard,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadSystemMedia } from '@/functionality';
import { useSystemMedia } from '@/ui/hooks';
import { Button } from '@/ui/kit/controls/button';
import { Field, type TextInputRef } from '@/ui/kit/controls/field';
import { Text } from '@/ui/kit/primitives/text';
import { radius, space, useTheme } from '@/ui/theme';

const SLIDE_MS = 6000;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [email, setEmail] = useState('');
  const [emailMode, setEmailMode] = useState(false);
  const step = useSharedValue(0);
  const scroller = useRef<ScrollViewInstance>(null);
  const input = useRef<TextInputRef>(null);
  const keyboard = useAnimatedKeyboard();
  const media = useSystemMedia();
  const slides = media.filter((item) => item.name.startsWith('onboarding-'));
  const slide = slides.length > 0 ? slides[index % slides.length] : undefined;

  const cardTop = insets.top + space.s4;
  const cardLeft = space.s4;
  const cardWidth = width - cardLeft * 2;
  const actionHeight = 160 + insets.bottom;
  const keyboardRoom = Math.min(height * 0.3, 260);
  const cardStep1Height = Math.max(180, height - cardTop - actionHeight - space.s4);

  const go = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(2, next));
      scroller.current?.scrollTo({ y: target * height, animated: true });
    },
    [height],
  );

  const scrollHandler = useAnimatedScrollHandler((event) => {
    step.value = Math.max(0, Math.min(2, event.contentOffset.y / height));
  });

  const enterEmail = useCallback(() => {
    setEmailMode(true);
    go(2);
  }, [go]);

  const onScrollSettled = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setEmailMode(Math.round(event.nativeEvent.contentOffset.y / height) >= 2);
    },
    [height],
  );

  useEffect(() => {
    if (emailMode) input.current?.focus();
    else Keyboard.dismiss();
  }, [emailMode]);

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

  const photoStyle = useAnimatedStyle(() => {
    const keyboardHeight = Math.max(keyboardRoom, keyboard.height.value);
    const cardStep2Height = Math.max(
      160,
      height - cardTop - actionHeight - keyboardHeight - space.s5,
    );
    return {
      top: interpolate(step.value, [0, 1, 2], [0, cardTop, cardTop], Extrapolation.CLAMP),
      left: interpolate(step.value, [0, 1, 2], [0, cardLeft, cardLeft], Extrapolation.CLAMP),
      width: interpolate(step.value, [0, 1, 2], [width, cardWidth, cardWidth], Extrapolation.CLAMP),
      height: interpolate(
        step.value,
        [0, 1, 2],
        [height, cardStep1Height, cardStep2Height],
        Extrapolation.CLAMP,
      ),
      borderRadius: interpolate(
        step.value,
        [0, 1, 2],
        [0, radius.section, radius.section],
        Extrapolation.CLAMP,
      ),
    };
  });

  const brandStyle = useAnimatedStyle(() => ({
    top: interpolate(
      step.value,
      [0, 1, 2],
      [insets.top + space.s4, space.s3, space.s3],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(step.value, [1, 2], [1, 0.72], Extrapolation.CLAMP),
      },
    ],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
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
        translateY: interpolate(
          step.value,
          [1, 2],
          [0, -Math.max(keyboardRoom, keyboard.height.value)],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const keyboardStyle = useAnimatedStyle(() => ({
    height: interpolate(
      step.value,
      [1, 2],
      [0, Math.max(keyboardRoom, keyboard.height.value)],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(step.value, [1, 2], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.root, { backgroundColor: color.ink }]}>
      <StatusBar style="light" />
      <Animated.View style={[styles.photo, photoStyle]}>
        {slide ? (
          <Animated.Image
            key={slide.mediaId}
            source={{ uri: slide.url }}
            resizeMode="cover"
            entering={FadeIn.duration(1000)}
            exiting={FadeOut.duration(800)}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Animated.View style={[styles.scrim, scrimStyle]} />
        <Animated.View style={[styles.brand, brandStyle]}>
          <Text role="heroSm" tone="onFill">
            Remember
          </Text>
          <ExpoImage
            source={require('../../../../assets/logo/logo-2048x2048.svg')}
            contentFit="contain"
            style={styles.logo}
          />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.action, actionStyle]}>
        <View style={[styles.actionInner, { paddingBottom: insets.bottom }]}>
          {emailMode ? (
            <Field
              label={t('onboarding.email.label')}
              placeholder={t('onboarding.email.prompt')}
              value={email}
              onChangeText={setEmail}
              inputRef={input}
              inputMode="email"
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
          ) : (
            <>
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
                onPress={enterEmail}
              />
            </>
          )}
        </View>
      </Animated.View>

      <Animated.View style={[styles.keyboard, keyboardStyle]}>
        <View style={styles.handle} />
      </Animated.View>

      <Animated.ScrollView
        ref={scroller}
        style={styles.scroll}
        contentContainerStyle={{ height: height * 3 }}
        snapToOffsets={[0, height, height * 2]}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onScrollEndDrag={onScrollSettled}
        onMomentumScrollEnd={onScrollSettled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  scroll: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  photo: {
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
