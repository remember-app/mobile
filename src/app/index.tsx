import { type Href, Redirect } from 'expo-router';

import { sessionState } from '@/functionality';

export default function Index() {
  if (__DEV__) return <Redirect href="/dev" />;
  const status = sessionState().status;
  const href: Href = status === 'signed-in' ? '/home' : '/onboarding/welcome';
  return <Redirect href={href} />;
}
