import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { parseInvite, stashInvite } from '@/functionality';

export default function InviteLinkScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  useEffect(() => {
    const parsed = typeof token === 'string' ? parseInvite(token) : null;
    if (parsed) stashInvite(parsed);
    router.replace('/onboarding/sign-up');
  }, [router, token]);

  return <View style={styles.root} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
