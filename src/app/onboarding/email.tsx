import { useRouter } from 'expo-router';
import { useState } from 'react';

import { OnboardingInput } from '@/ui/components/onboarding/input';

export default function EmailScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const ready = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <OnboardingInput
      step={1}
      label="Почта"
      value={email}
      onChangeText={setEmail}
      placeholder="you@example.com"
      valid={ready}
      inputMode="email"
      autoComplete="email"
      onSubmit={() =>
        router.push({ pathname: '/onboarding/code', params: { email: email.trim() } })
      }
    />
  );
}
