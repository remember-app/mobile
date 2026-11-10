import { Redirect } from 'expo-router';

import { sessionState } from '@/functionality';

export default function Index() {
  const status = sessionState().status;
  const href =
    status === 'signed-in'
      ? '/home'
      : status === 'needs-username'
        ? '/onboarding/username'
        : '/onboarding/welcome';
  return <Redirect href={href} />;
}
