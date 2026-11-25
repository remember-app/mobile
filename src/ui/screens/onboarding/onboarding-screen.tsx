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
const STEP_MS = 520;
type Phase = 'providers' | 'email' | 'invite' | 'code' | 'username';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const touched = useRef(false);
  const seenStep = useRef(false);
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
      easing: Easing.inOut(Easing.cubic),
    });
  }, [step, stepIndex]);

  useEffect(() => {
    if (!seenStep.current) {
      seenStep.current = true;
      return;
    }
    if (stepIndex !== 0) touched.current = true;
  }, [stepIndex]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!touched.current) setStepIndex(1);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

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
              easing: Easing.inOut(Easing.cubic),
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
            <Button
              label={t('onboarding.email.label')}
              variant="primary"
              icon={Mail}
              onPress={enterEmail}
            />
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
});
