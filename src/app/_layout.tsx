// ponytail: each package index `require`s every weight it ships, so all of them land in the bundle
// though only these six are loaded. Import the faces by their own paths and add a `*.ttf` module
// declaration if the bundle size ever starts to matter.
import { Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold } from '@expo-google-fonts/onest';
import { Unbounded_600SemiBold, Unbounded_700Bold, useFonts } from '@expo-google-fonts/unbounded';
import { Image } from 'expo-image';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AuthProvider, useAuth } from '@/auth';
import { lockPortrait } from '@/orientation';
import { usePush } from '@/push';
import { useTheme } from '@/theme';
import { useUploads } from '@/uploads';

// Hold the splash until the stored session has been checked, so no screen flashes
// before the gate below knows which ones to allow.
SplashScreen.preventAutoHideAsync().catch(() => {});

// The product is portrait, and `app.json` no longer holds it there — `@/orientation` says why. Here
// beside the splash and not in an effect: this is the app coming up, and it has to be true of the
// first screen drawn as much as of the fourteenth.
lockPortrait();

// A ceiling on what `expo-image` keeps on disk. The open frame holds its picture there under a key
// of its own, which is what makes a frame looked at a second time come off the phone instead of
// down the wire; the contact sheet writes its tiles there too, but filed under the signed url they
// arrived by, so those are never read again and only wait to be evicted (`kit/tile.tsx` — seen in
// the m-19 review, left alone as its own job). Either way it fills, and on ios it has no limit:
// SDWebImage, which expo-image is built on there, defaults `maxDiskSize` to 0, meaning keep
// everything for ever. 250MB with the oldest going first is exactly what Glide already does on
// android without being asked, so the number is that one, and the two platforms hold the same
// amount. Only ios: the method is not in the android native module, and calling it there is a
// crash on the way up rather than a no-op. Here beside the lock because it has to be true before
// the first picture is fetched, not after some screen mounts.
if (Platform.OS === 'ios') Image.configureCache({ maxDiskSize: 262144000 });

export default function RootLayout() {
  const { name, color } = useTheme();

  // The kit's colours where the navigator itself paints: `background` is what the stack puts behind
  // a screen and behind the whole card stack mid-transition, so this is what keeps a push from
  // flashing the system white. The rest are for the chrome React Navigation still draws on its own.
  // The base is picked by name for the one thing left in it — `dark`, which is what React Navigation
  // asks itself when it needs a colour nobody set.
  const navigation = {
    ...(name === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      primary: color.accent,
      background: color.ink,
      card: color.surface,
      text: color.paper,
      border: color.line,
      notification: color.accent,
    },
  };

  return (
    <ThemeProvider value={navigation}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * The gate. Only the screens matching the session status exist at all — expo-router drops the
 * rest from the navigator, so an unavailable route falls back to the first one still declared.
 */
function RootNavigator() {
  const { status } = useAuth();

  // Every word in the product is in one of these six faces — Unbounded for headings, Onest for
  // everything else, both with Cyrillic — so the splash gate below waits on them rather than
  // letting the first screen draw in the system font and swap. `error` counts as settled: a missing
  // font is not a reason to sit on the splash forever.
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_600SemiBold,
    Unbounded_700Bold,
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
  });

  // Pushes, tapped pushes and a stashed invite link — all of them only mean anything once
  // there is a session, and all of them gate on that themselves.
  usePush();

  // Here and not on the upload screen: a queue left over from a launch that was cut short, or
  // from a tunnel, has to pick itself back up whatever screen the app opens on.
  useUploads();

  useEffect(() => {
    if (status !== 'loading' && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [status, fontsLoaded, fontError]);

  // No native header anywhere: every screen draws the kit's own appbar over the kit's own
  // background, and a white system bar on top of that would be two headers.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="index" options={{ title: 'Remember' }} />
        <Stack.Screen name="create" options={{ title: 'New memory' }} />
        {/* One screen for the whole memory — the frames, the movies and the people are its three
            faces and not three routes (TASK-101). Picking material off the phone stays its own,
            because it is a screen one comes back from. */}
        <Stack.Screen name="memory/[id]" options={{ title: 'Memory' }} />
        {/* Who is in the memory, and what the event is — a screen of its own since TASK-209, behind
            the capsule over the feed. The people used to be a third face of the memory itself. */}
        <Stack.Screen name="memory/[id]/settings" options={{ title: 'Memory settings' }} />
        {/* And the one way to change the name, the days and the cover: a screen because a calendar
            does not fit on a sheet (spec 10.8.3). */}
        <Stack.Screen name="memory/[id]/edit" options={{ title: 'Edit the memory' }} />
        <Stack.Screen name="memory/[id]/upload" options={{ title: 'Upload' }} />
        {/* Asking for a movie is four steps and a screen of its own (TASK-162); the movies of a
            memory stay a face of it and not a route. */}
        <Stack.Screen name="memory/[id]/order" options={{ title: 'Order a movie' }} />
        {/* And the waiting the order leads to (TASK-163): one montage being made, which is a route
            of one row — the movies of a memory are still a face of it and not a screen. */}
        <Stack.Screen
          name="memory/[id]/montage/[montageId]"
          options={{ title: 'Making a movie' }}
        />
        <Stack.Screen name="contacts" options={{ title: 'Contacts' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
      </Stack.Protected>

      {/* An account with a session and no username still owes two things, and they are declared in
          the order they are walked: the agreement first, because the api refuses a first username
          without it (403, TASK-139), and the name second. The first screen a guard declares is the
          one the navigator falls back to, so signing in lands on the agreement — and accepting it
          is what moves the person on to the name. */}
      <Stack.Protected guard={status === 'needs-username'}>
        <Stack.Screen name="consent" options={{ title: 'Agreement' }} />
        <Stack.Screen name="set-username" options={{ title: 'Pick a username' }} />
      </Stack.Protected>

      {/* Kept mounted while the session is still loading too, so the app coming up cold has a
          screen to stand on under the splash. */}
      <Stack.Protected guard={status === 'signed-out' || status === 'loading'}>
        <Stack.Screen name="login" options={{ title: 'Sign in' }} />
        <Stack.Screen name="login/email" options={{ title: 'Sign in by email' }} />
        <Stack.Screen name="login/code" options={{ title: 'Code from the letter' }} />
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
