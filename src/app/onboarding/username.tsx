import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OnboardingInput } from '@/ui/components/onboarding/input';

const SHAPE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,28}[a-zA-Z0-9]$/;

export default function UsernameScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const ready = SHAPE.test(username);

  return (
    <OnboardingInput
      step={3}
      caption={t('onboarding.username.prompt')}
      label={t('onboarding.username.label')}
      value={username}
      onChangeText={setUsername}
      placeholder="nickname"
      prefix="@"
      valid={ready}
      autoCapitalize="none"
      autoCorrect={false}
      autoFocus={false}
      onSubmit={() => router.replace({ pathname: '/home', params: { celebrate: username } })}
    />
  );
}
