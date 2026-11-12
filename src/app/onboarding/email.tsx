import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { pendingInvite, requestCode } from '@/functionality';
import { OnboardingInput } from '@/ui/components/onboarding/input';
import { InviteSheet } from '@/ui/components/onboarding/invite-sheet';

export default function EmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const address = email.trim();
  const ready = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await requestCode(address);
      if (!pendingInvite() && !result.registered) {
        setInvite(true);
        return;
      }
      router.navigate({ pathname: '/onboarding/code', params: { email: address } });
    } catch {
      setError(t('onboarding.email.error'));
    } finally {
      setBusy(false);
    }
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
        onChangeText={(next) => {
          setEmail(next);
          setError(null);
        }}
        placeholder="you@example.com"
        valid={ready}
        error={error ?? undefined}
        inputMode="email"
        autoComplete="email"
        onSubmit={submit}
      />
      <InviteSheet visible={invite} onClose={() => setInvite(false)} onAccepted={accept} />
    </>
  );
}
