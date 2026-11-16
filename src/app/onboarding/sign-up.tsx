import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  acceptInvite,
  checkInvite,
  clearPendingInvite,
  confirmCode,
  isUsernameShapeValid,
  loadAvatar,
  pendingInvite,
  readText,
  requestCode,
  setName as saveName,
  setUsername as saveUsername,
  sessionState,
  signOut,
  uploadAvatar,
} from '@/functionality';
import { isApiError } from '@/integrations/api';
import { CodeInput, type CodeOutcome } from '@/ui/components/code-input';
import { OnboardingInput } from '@/ui/components/onboarding/input';
import { InviteSheet } from '@/ui/components/onboarding/invite-sheet';
import { StepDots } from '@/ui/components/onboarding/steps';
import { useAvatar, useSession } from '@/ui/hooks';
import { Avatar } from '@/ui/kit/avatar';
import { Button } from '@/ui/kit/button';
import { Field } from '@/ui/kit/field';
import { Text } from '@/ui/kit/text';
import { font, space, useTheme } from '@/ui/theme';

type Step = 'email' | 'code' | 'username';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const params = useLocalSearchParams<{ step?: string; email?: string }>();
  const startStep: Step =
    params.step === 'code' || params.step === 'username' ? params.step : 'email';
  const startEmail = Array.isArray(params.email) ? params.email[0] : params.email;

  const [step, setStep] = useState<Step>(startStep);
  const [email, setEmail] = useState(startEmail ?? '');

  const [invite, setInvite] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [code, setCode] = useState('');
  const [outcome, setOutcome] = useState<CodeOutcome | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  const avatar = useAvatar();
  const session = useSession();
  const account = 'account' in session ? session.account : undefined;
  const [username, setUsername] = useState('');
  const [name, setName] = useState(account?.name ?? '');
  const [userError, setUserError] = useState<string | null>(null);
  const [userBusy, setUserBusy] = useState(false);

  const address = email.trim();
  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
  const usernameReady = isUsernameShapeValid(username);

  useEffect(() => {
    if (step === 'username') void loadAvatar();
  }, [step]);

  const submitEmail = async () => {
    if (!emailReady || emailBusy) return;
    setEmailBusy(true);
    setEmailError(null);
    try {
      const result = await requestCode(address);
      if (!pendingInvite() && !result.registered) {
        setInvite(true);
        return;
      }
      setStep('code');
    } catch {
      setEmailError(t('onboarding.email.error'));
    } finally {
      setEmailBusy(false);
    }
  };

  const accept = () => {
    setInvite(false);
    setStep('code');
  };

  const verify = async (value: string) => {
    if (codeBusy) return;
    setCodeBusy(true);
    let entered = false;
    try {
      const inviteCode = pendingInvite();
      if (inviteCode) {
        try {
          await checkInvite(inviteCode);
        } catch (failure) {
          if (isApiError(failure) && [404, 409, 410].includes(failure.status)) {
            clearPendingInvite();
            setStep('email');
            return;
          }
          throw failure;
        }
      }
      await confirmCode(email, value);
      entered = true;
      if (inviteCode) await acceptInvite(inviteCode);
      setOutcome('ok');
    } catch {
      if (entered) await signOut().catch(() => undefined);
      setOutcome('error');
    } finally {
      setCodeBusy(false);
    }
  };

  const change = (next: string) => {
    setCode(next);
    setOutcome(null);
    if (next.length === 6) void verify(next);
  };

  const paste = async () => {
    const text = await readText();
    const digits = text.replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    setCode(digits);
    setOutcome(null);
    if (digits.length === 6) void verify(digits);
  };

  const resend = async () => {
    if (codeBusy) return;
    if (!email) {
      setStep('email');
      return;
    }
    setCodeBusy(true);
    try {
      await requestCode(email);
      setCode('');
      setOutcome(null);
    } catch {
      setOutcome('error');
    } finally {
      setCodeBusy(false);
    }
  };

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
    await uploadAvatar(asset.uri, asset.fileName ?? `avatar.${extension}`).catch(() => undefined);
  };

  const submitUsername = async () => {
    if (!usernameReady || userBusy) return;
    setUserBusy(true);
    try {
      await saveUsername(username);
      await saveName(name.trim() || null);
      router.replace({ pathname: '/home', params: { celebrate: username } });
    } catch {
      setUserError(t('onboarding.username.taken'));
    } finally {
      setUserBusy(false);
    }
  };

  if (step === 'email') {
    return (
      <>
        <OnboardingInput
          step={1}
          caption={t('onboarding.email.prompt')}
          label={t('onboarding.email.label')}
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            setEmailError(null);
          }}
          placeholder="you@example.com"
          valid={emailReady}
          error={emailError ?? undefined}
          inputMode="email"
          autoComplete="email"
          onSubmit={submitEmail}
        />
        <InviteSheet visible={invite} onClose={() => setInvite(false)} onAccepted={accept} />
      </>
    );
  }

  if (step === 'code') {
    return (
      <View style={styles.root}>
        <Pressable style={styles.fill} onPress={Keyboard.dismiss}>
          <View style={[styles.top, { paddingTop: insets.top + space.s3 }]}>
            <StepDots step={2} total={3} />
          </View>
          <View style={styles.body}>
            <Text role="bodySm" tone="muted">
              {email ? (
                <>
                  {t('onboarding.code.sentTo')}{' '}
                  <Text role="bodySm" tone="accent" style={styles.email}>
                    {email}
                  </Text>
                </>
              ) : (
                t('onboarding.code.sentPlain')
              )}
            </Text>
            <CodeInput
              label={t('onboarding.code.label')}
              value={code}
              onChangeText={change}
              outcome={outcome}
              onSettled={(result) => {
                if (result === 'ok') {
                  if (sessionState().status === 'signed-in') {
                    router.replace('/home');
                    return;
                  }
                  setStep('username');
                  return;
                }
                setCode('');
                setOutcome(null);
              }}
            />
            <Button
              label={t('onboarding.code.resend')}
              variant="link"
              disabled={codeBusy}
              onPress={() => void resend()}
              style={styles.resend}
            />
          </View>
          <View style={styles.space} />
        </Pressable>
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.s2 }]}>
          <Button
            label={t('onboarding.code.paste')}
            variant="primary"
            onPress={() => void paste()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Pressable style={styles.fill} onPress={Keyboard.dismiss}>
        <View style={[styles.top, { paddingTop: insets.top + space.s3 }]}>
          <StepDots step={3} total={3} />
        </View>
        <View style={styles.body}>
          <Text role="bodySm" tone="muted">
            {t('onboarding.username.prompt')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.username.avatar')}
            onPress={() => void pick()}
            style={styles.avatar}
          >
            <Avatar name={name.trim() || username} size={88} uri={avatar.url} />
            <View style={[styles.badge, { backgroundColor: color.accent, borderColor: color.ink }]}>
              <Camera size={16} color={color.onFill} />
            </View>
          </Pressable>
          <Field
            label={t('onboarding.username.label')}
            value={username}
            onChangeText={(next) => {
              setUsername(next);
              setUserError(null);
            }}
            placeholder="nickname"
            prefix="@"
            maxLength={30}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={false}
            returnKeyType="done"
            onSubmitEditing={() => void submitUsername()}
          />
          <Field
            label={t('onboarding.username.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('onboarding.username.name')}
            autoCapitalize="words"
            maxLength={200}
            returnKeyType="done"
            onSubmitEditing={() => void submitUsername()}
          />
          {userError ? (
            <Text role="hint" tone="danger">
              {userError}
            </Text>
          ) : null}
        </View>
        <View style={styles.space} />
      </Pressable>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.s2 }]}>
        <Button
          label={t('onboarding.username.register')}
          variant="primary"
          disabled={!usernameReady || userBusy}
          onPress={() => void submitUsername()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  top: {
    paddingHorizontal: space.s5,
    gap: space.s4,
  },
  body: {
    paddingHorizontal: space.s5,
    paddingTop: space.s6,
    gap: space.s3,
  },
  email: {
    fontFamily: font.semi,
  },
  resend: {
    alignSelf: 'flex-end',
  },
  avatar: {
    alignSelf: 'center',
    marginVertical: space.s3,
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  space: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: space.s5,
  },
});
