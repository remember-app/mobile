import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Mail } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Path, Svg } from 'react-native-svg';

import {
  acceptInvite,
  checkEmail,
  checkInvite,
  clearPendingInvite,
  confirmCode,
  isUsernameShapeValid,
  loadSystemMedia,
  pendingInvite,
  readLastEmail,
  requestCode,
  sessionState,
  setUsername,
  stashInvite,
  writeLastEmail,
} from '@/functionality';
import { ArrowField } from '@/ui/components/forms/arrow-field';
import { CodeInput, type CodeOutcome } from '@/ui/components/forms/code-input';
import { useSystemMedia } from '@/ui/hooks';
import { Button } from '@/ui/kit/controls/button';
import type { TextInputRef } from '@/ui/kit/controls/field';
import { Text } from '@/ui/kit/primitives/text';
import { radius, space, useTheme } from '@/ui/theme';

const SLIDE_MS = 6000;
const STEP_MS = 380;
type Phase = 'providers' | 'email' | 'invite' | 'code' | 'username';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function GoogleGlyph({
  size = 20,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

function AppleGlyph({
  size = 20,
  color = '#FFFFFF',
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const side = size * 1.3;
  return (
    <Svg width={side} height={side} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M17.05 12.54c-.02-2.2 1.8-3.27 1.88-3.32-1.03-1.5-2.63-1.71-3.2-1.73-1.36-.14-2.66.8-3.35.8-.7 0-1.76-.78-2.9-.76-1.49.02-2.87.87-3.64 2.2-1.55 2.69-.4 6.67 1.11 8.86.74 1.08 1.62 2.29 2.78 2.25 1.12-.05 1.54-.72 2.9-.72 1.35 0 1.74.72 2.92.7 1.21-.02 1.98-1.1 2.72-2.19.86-1.25 1.21-2.46 1.23-2.53-.03-.01-2.36-.91-2.4-3.66zM14.9 4.9c.62-.75 1.04-1.8.92-2.84-.9.04-1.99.6-2.64 1.35-.58.67-1.09 1.74-.96 2.77 1 .08 2.02-.51 2.68-1.28z"
      />
    </Svg>
  );
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('providers');
  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [username, setUsernameText] = useState('');
  const [outcome, setOutcome] = useState<CodeOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const step = useSharedValue(0);
  const actionSize = useSharedValue(160 + insets.bottom);
  const stepDuration = useRef(STEP_MS);
  const input = useRef<TextInputRef>(null);
  const codeInput = useRef<TextInputRef>(null);
  const pending = useRef<(() => void | Promise<void>) | null>(null);
  const keyboard = useAnimatedKeyboard();
  const media = useSystemMedia();
  const slides = media.filter((item) => item.name.startsWith('onboarding-'));
  const slide = slides.length > 0 ? slides[index % slides.length] : undefined;

  const cardTop = insets.top + space.s4;
  const cardLeft = space.s4;
  const cardWidth = width - cardLeft * 2;
  const keyboardRoom = Math.min(height * 0.3, 260);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    step.value = withTiming(stepIndex, {
      duration: stepDuration.current,
      easing: Easing.out(Easing.cubic),
    });
  }, [step, stepIndex]);

  useEffect(() => {
    if (stepIndex !== 2) {
      Keyboard.dismiss();
      return;
    }
    if (phase === 'email' || phase === 'username') input.current?.focus();
    if (phase === 'invite' || phase === 'code') codeInput.current?.focus();
  }, [phase, stepIndex]);

  useEffect(() => {
    const sync = (event: { duration?: number }) => {
      stepDuration.current = event.duration || STEP_MS;
    };
    const show = Keyboard.addListener('keyboardWillShow', sync);
    const hide = Keyboard.addListener('keyboardWillHide', sync);
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    void loadSystemMedia();
    void readLastEmail().then((saved) => {
      if (saved) setEmail(saved);
    });
  }, []);

  useEffect(() => {
    if (slides.length === 0) return;
    const rotation = setInterval(() => {
      setIndex((value) => (value + 1) % slides.length);
    }, SLIDE_MS);
    return () => clearInterval(rotation);
  }, [slides.length]);

  const enterEmail = useCallback(() => {
    stepDuration.current = STEP_MS;
    setPhase('email');
    setStepIndex(2);
  }, []);

  const submitEmail = useCallback(async () => {
    const value = email.trim();
    if (!emailValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const registered = await checkEmail(value);
      void writeLastEmail(value);
      setCode('');
      setInviteCode('');
      if (registered) {
        await requestCode(value);
        setPhase('code');
      } else {
        setPhase('invite');
      }
    } catch {
      setError(t('onboarding.email.error'));
    } finally {
      setBusy(false);
    }
  }, [busy, email, emailValid, t]);

  const resendCode = useCallback(async () => {
    const value = email.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestCode(value);
    } catch {
      setError(t('onboarding.email.error'));
    } finally {
      setBusy(false);
    }
  }, [busy, email, t]);

  const onOutcomeSettled = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    setOutcome(null);
    void action?.();
  }, []);

  const verifyInvite = useCallback(
    async (next: string) => {
      if (next.length !== 6 || busy) return;
      setBusy(true);
      setError(null);
      try {
        await checkInvite(next);
        stashInvite(next);
        await requestCode(email.trim());
        pending.current = () => {
          setCode('');
          setPhase('code');
        };
        setOutcome('ok');
      } catch {
        setError(t('onboarding.invite.invalid'));
        pending.current = () => setInviteCode('');
        setOutcome('error');
      } finally {
        setBusy(false);
      }
    },
    [busy, email, t],
  );

  const verifyCode = useCallback(
    async (next: string) => {
      if (next.length !== 6 || busy) return;
      setBusy(true);
      setError(null);
      try {
        await confirmCode(email.trim(), next);
        void writeLastEmail(email.trim());
        if (sessionState().status === 'needs-username') {
          pending.current = () => {
            setUsernameText('');
            setPhase('username');
          };
        } else {
          pending.current = async () => {
            const invite = pendingInvite();
            if (invite) {
              await acceptInvite(invite);
              clearPendingInvite();
            }
            router.replace('/home');
          };
        }
        setOutcome('ok');
      } catch {
        setError(t('onboarding.code.error'));
        pending.current = () => setCode('');
        setOutcome('error');
      } finally {
        setBusy(false);
      }
    },
    [busy, email, router, t],
  );

  const submitUsername = useCallback(async () => {
    const value = username.trim();
    if (!isUsernameShapeValid(value) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setUsername(value);
      const invite = pendingInvite();
      if (invite) {
        await acceptInvite(invite);
        clearPendingInvite();
      }
      router.replace('/home');
    } catch {
      setError(t('onboarding.username.taken'));
    } finally {
      setBusy(false);
    }
  }, [busy, router, t, username]);

  const blurInput = useCallback(() => {
    if (phase === 'email' || phase === 'username') input.current?.blur();
    if (phase === 'invite' || phase === 'code') codeInput.current?.blur();
    Keyboard.dismiss();
    setStepIndex(1);
  }, [phase]);

  const togglePhoto = useCallback(() => {
    if (phase !== 'providers') {
      blurInput();
      return;
    }
    if (stepIndex === 2) {
      Keyboard.dismiss();
      return;
    }
    stepDuration.current = STEP_MS;
    setStepIndex(stepIndex === 0 ? 1 : 0);
  }, [blurInput, phase, stepIndex]);

  const photoStyle = useAnimatedStyle(() => {
    const keyboardHeight = Math.max(keyboardRoom, keyboard.height.value);
    const cardStep1Height = Math.max(180, height - cardTop - actionSize.value - space.s3);
    const cardStep2Height = Math.max(
      160,
      height - cardTop - actionSize.value - keyboardHeight - space.s3,
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
      [0, actionSize.value, actionSize.value],
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

  return (
    <View style={[styles.root, { backgroundColor: color.ink }]}>
      <StatusBar style="light" />
      <AnimatedPressable onPress={togglePhoto} style={[styles.photo, photoStyle]}>
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
      </AnimatedPressable>

      <Animated.View style={[styles.action, actionStyle]}>
        <View
          style={[styles.actionInner, { paddingBottom: insets.bottom }]}
          onLayout={(event) => {
            actionSize.value = withTiming(event.nativeEvent.layout.height, {
              duration: STEP_MS,
              easing: Easing.out(Easing.cubic),
            });
          }}
        >
          {phase === 'email' ? (
            <ArrowField
              label={t('onboarding.email.label')}
              placeholder={t('onboarding.email.prompt')}
              value={email}
              onChangeText={setEmail}
              valid={emailValid}
              busy={busy}
              onSubmit={() => void submitEmail()}
              onFocus={() => setStepIndex(2)}
              inputRef={input}
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : phase === 'invite' ? (
            <>
              <Text role="hint" tone="muted">
                {t('onboarding.invite.title')}
              </Text>
              <CodeInput
                key="invite-code"
                label={t('onboarding.invite.code')}
                value={inviteCode}
                onChangeText={(next) => {
                  setInviteCode(next);
                  if (next.length === 6) void verifyInvite(next);
                }}
                outcome={outcome}
                onSettled={onOutcomeSettled}
                onFocus={() => setStepIndex(2)}
                inputRef={codeInput}
                alnum
              />
            </>
          ) : phase === 'code' ? (
            <>
              <View style={styles.codeHead}>
                <Text role="hint" tone="muted">
                  {t('onboarding.code.sentTo')} {email.trim()}
                </Text>
                <Button
                  label={t('onboarding.code.resend')}
                  variant="link"
                  disabled={busy}
                  onPress={() => void resendCode()}
                />
              </View>
              <CodeInput
                key="email-code"
                label={t('onboarding.code.label')}
                value={code}
                onChangeText={(next) => {
                  setCode(next);
                  if (next.length === 6) void verifyCode(next);
                }}
                outcome={outcome}
                onSettled={onOutcomeSettled}
                onFocus={() => setStepIndex(2)}
                inputRef={codeInput}
              />
            </>
          ) : phase === 'username' ? (
            <ArrowField
              label={t('onboarding.username.label')}
              placeholder={t('onboarding.username.prompt')}
              value={username}
              onChangeText={setUsernameText}
              valid={isUsernameShapeValid(username.trim())}
              busy={busy}
              onSubmit={() => void submitUsername()}
              onFocus={() => setStepIndex(2)}
              inputRef={input}
              autoCorrect={false}
            />
          ) : (
            <>
              <View style={styles.providers}>
                <Button
                  label="Google"
                  variant="secondary"
                  icon={GoogleGlyph}
                  wide={false}
                  style={styles.provider}
                />
                <Button
                  label="Apple"
                  variant="secondary"
                  icon={AppleGlyph}
                  wide={false}
                  style={styles.provider}
                />
              </View>
              <Button
                label={t('onboarding.email.label')}
                variant="primary"
                icon={Mail}
                onPress={enterEmail}
              />
            </>
          )}
          {error ? (
            <Text role="hint" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
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
    left: space.s4,
    right: space.s4,
    alignItems: 'center',
    gap: space.s3,
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
    paddingHorizontal: space.s4,
    paddingTop: space.s3,
    gap: space.s3,
  },
  codeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
  },
  providers: {
    flexDirection: 'row',
    gap: space.s3,
  },
  provider: {
    flex: 1,
  },
});
