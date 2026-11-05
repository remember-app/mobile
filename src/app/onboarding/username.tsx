import { useRouter } from 'expo-router';
import { useState } from 'react';

import { OnboardingInput } from '@/ui/components/onboarding/input';

const SHAPE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,28}[a-zA-Z0-9]$/;

export default function UsernameScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const ready = SHAPE.test(username);

  return (
    <OnboardingInput
      step={3}
      label="Ник"
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
