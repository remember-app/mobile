import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Mail } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInLeft,
  FadeOut,
  FadeOutRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadSystemMedia } from '@/functionality';
import { useSystemMedia } from '@/ui/hooks';
import { Button } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { radius, space, useTheme } from '@/ui/theme';

const SLIDE_MS = 6000;
const REVEAL_AFTER_MS = 6500;
const TAPS_TO_REVEAL = 3;

export default function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { color } = useTheme();
  const [index, setIndex] = useState(0);
  const taps = useRef(0);
  const dragged = useRef(false);
  const startX = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroller = useRef<ScrollViewInstance>(null);
  const action = useSharedValue(0);
  const room = 56 + space.s4 + insets.bottom;
  const language = i18n.language === 'en' ? 'en' : 'ru';
  const media = useSystemMedia();
  const slides = media.filter((item) => item.name.startsWith('onboarding-'));
  const slide = slides.length > 0 ? slides[index % slides.length] : undefined;
  const caption = slide?.captions ? slide.captions[language] : null;

  const open = useCallback(() => {
    scroller.current?.scrollTo({ y: room, animated: true });
    action.value = withTiming(room, { duration: 380, easing: Easing.out(Easing.cubic) });
    if (timer.current) clearTimeout(timer.current);
  }, [action, room]);

  useEffect(() => {
    void loadSystemMedia();
  }, []);

  useEffect(() => {
    const rotation =
      slides.length > 0
        ? setInterval(() => {
            setIndex((value) => (value + 1) % slides.length);
          }, SLIDE_MS)
        : null;
    timer.current = setTimeout(open, REVEAL_AFTER_MS);
    return () => {
      if (rotation) clearInterval(rotation);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, slides.length]);

  const actionStyle = useAnimatedStyle(() => ({ height: action.value }));
  const captionStyle = useAnimatedStyle(() => ({
    bottom: space.s5 + insets.bottom * (1 - action.value / room),
  }));

  return (
    <View style={[styles.root, { backgroundColor: color.ink }]}>
      <StatusBar style="light" />
      <View style={styles.photo}>
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
        <View style={styles.scrim} />
        <View style={[styles.brand, { top: insets.top + space.s4 }]}>
          <Text role="heroSm" tone="onFill">
            Remember
          </Text>
          <Image
            source={require('../../../assets/images/logo.svg')}
            contentFit="contain"
            style={styles.logo}
          />
        </View>
        <Animated.View style={[styles.caption, captionStyle]}>
          {caption ? (
            <Animated.View
              key={index}
              entering={FadeInLeft.duration(600)}
              exiting={FadeOutRight.duration(400)}
            >
              <Text role="display" tone="onFill">
                {caption}
              </Text>
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ height: height + room }}
        bounces={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        snapToOffsets={[0, room]}
        decelerationRate="fast"
        onScroll={(event) => {
          action.value = Math.min(Math.max(event.nativeEvent.contentOffset.y, 0), room);
        }}
        onScrollBeginDrag={() => {
          dragged.current = true;
        }}
        onScrollEndDrag={() => {
          setTimeout(() => {
            dragged.current = false;
          }, 200);
        }}
        onTouchStart={(event) => {
          startX.current = event.nativeEvent.pageX;
        }}
        onTouchEnd={(event) => {
          if (event.nativeEvent.pageX - startX.current > 50) {
            open();
            return;
          }
          if (dragged.current) return;
          taps.current += 1;
          if (taps.current >= TAPS_TO_REVEAL) open();
        }}
      />
      <Animated.View style={[styles.action, actionStyle]}>
        <View style={[styles.actionInner, { paddingBottom: insets.bottom }]}>
          <Button
            label={t('onboarding.welcome.continue')}
            variant="primary"
            icon={Mail}
            onPress={() => router.navigate('/onboarding/email')}
          />
        </View>
      </Animated.View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ height: height + room }}
        bounces={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        snapToOffsets={[0, room]}
        decelerationRate="fast"
        onScroll={(event) => {
          action.value = Math.min(Math.max(event.nativeEvent.contentOffset.y, 0), room);
        }}
        onScrollBeginDrag={() => {
          dragged.current = true;
        }}
        onScrollEndDrag={() => {
          setTimeout(() => {
            dragged.current = false;
          }, 200);
        }}
        onTouchStart={(event) => {
          startX.current = event.nativeEvent.pageX;
        }}
        onTouchEnd={(event) => {
          if (event.nativeEvent.pageX - startX.current > 50) {
            open();
            return;
          }
          if (dragged.current) return;
          taps.current += 1;
          if (taps.current >= TAPS_TO_REVEAL) open();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  photo: {
    flex: 1,
    overflow: 'hidden',
    borderBottomLeftRadius: radius.section,
    borderBottomRightRadius: radius.section,
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
  caption: {
    position: 'absolute',
    left: space.s5,
    maxWidth: '82%',
  },
  action: {
    overflow: 'hidden',
    zIndex: 2,
  },
  actionInner: {
    paddingHorizontal: space.s5,
    paddingTop: space.s4,
  },
  scroll: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
});
