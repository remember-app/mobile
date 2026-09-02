import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/auth';

// Hold the splash until the stored session has been checked, so no screen flashes
// before the gate below knows which ones to allow.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

/**
 * The gate. Only the screens matching the session status exist at all — expo-router drops the
 * rest from the navigator, so an unavailable route falls back to the first one still declared.
 */
function RootNavigator() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  return (
    <Stack>
      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="index" options={{ title: 'Remember' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'needs-username'}>
        <Stack.Screen name="set-username" options={{ title: 'Pick a username' }} />
      </Stack.Protected>

      {/* Kept mounted while the session is still loading too, so a cold-start deep link
          (remember://auth/email?token=…) has a screen to land on. The splash covers it. */}
      <Stack.Protected guard={status === 'signed-out' || status === 'loading'}>
        <Stack.Screen name="login" options={{ title: 'Sign in' }} />
        <Stack.Screen name="auth/email" options={{ title: 'Signing in' }} />
      </Stack.Protected>
    </Stack>
  );
}
