import { useRouter } from 'expo-router';
import { useState } from 'react';

import { OnboardingInput } from '@/ui/components/onboarding/input';
import { isRegisteredEmail } from '@/ui/mocks/profile';

export default function EmailScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const address = email.trim();
  const ready = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

  const submit = () => {
    if (isRegisteredEmail(address)) {
      router.push({ pathname: '/onboarding/code', params: { email: address } });
      return;
    }
    router.push({ pathname: '/onboarding/invite', params: { email: address } });
  };

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
      onSubmit={submit}
    />
  );
}
