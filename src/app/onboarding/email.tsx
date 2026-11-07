import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { pendingInvite } from '@/functionality';
import { OnboardingInput } from '@/ui/components/onboarding/input';
import { InviteSheet } from '@/ui/components/onboarding/invite-sheet';
import { isRegisteredEmail } from '@/ui/mocks/profile';

export default function EmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState(false);
  const address = email.trim();
  const ready = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

  const submit = () => {
    if (isRegisteredEmail(address) || pendingInvite()) {
      router.navigate({ pathname: '/onboarding/code', params: { email: address } });
      return;
    }
    setInvite(true);
  };

  const accept = () => {
    setInvite(false);
    router.navigate({ pathname: '/onboarding/code', params: { email: address } });
  };

  return (
    <>
      <OnboardingInput
        step={1}
        caption={t('onboarding.email.prompt')}
        label={t('onboarding.email.label')}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        valid={ready}
        inputMode="email"
        autoComplete="email"
        onSubmit={submit}
      />
      <InviteSheet visible={invite} onClose={() => setInvite(false)} onAccepted={accept} />
    </>
  );
}
