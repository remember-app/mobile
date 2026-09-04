import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/auth';
import { usePush } from '@/push';
import { useUploads } from '@/uploads';

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

  // Pushes, tapped pushes and a stashed invite link — all of them only mean anything once
  // there is a session, and all of them gate on that themselves.
  usePush();

  // Here and not on the upload screen: a queue left over from a launch that was cut short, or
  // from a tunnel, has to pick itself back up whatever screen the app opens on.
  useUploads();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  return (
    <Stack>
      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="index" options={{ title: 'Remember' }} />
        <Stack.Screen name="create" options={{ title: 'New memory' }} />
        <Stack.Screen name="memory/[id]" options={{ title: 'Memory' }} />
        <Stack.Screen name="memory/[id]/upload" options={{ title: 'Upload' }} />
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

      {/* Behind no guard, and it cannot be put behind two: expo-router reads every declared
          name whatever the guard says, and the same name twice is «Screen names must be
          unique» at startup. An invite link means something in every state anyway — signed in
          it joins the memory, signed out it takes the token into keeping and asks for a
          sign-in — so the screen decides for itself. Declared last so that the screen a state
          falls back to (index when ready, login when not) is still the first one it declares. */}
      <Stack.Screen name="invite" options={{ title: 'Invitation' }} />
    </Stack>
  );
}
