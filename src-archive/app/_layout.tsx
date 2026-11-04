import {
  Onest_400Regular,
  Onest_500Medium,
  Onest_600SemiBold,
  Onest_700Bold,
} from '@expo-google-fonts/onest';
import { Unbounded_600SemiBold, Unbounded_700Bold, useFonts } from '@expo-google-fonts/unbounded';
import { Image } from 'expo-image';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useEdgeBack } from '@/lib/gesture';
import { lockPortrait } from '@/lib/orientation';
import { usePush } from '@/lib/push';
import { useLaunchUpdate } from '@/lib/updates';
import { useUploads } from '@/lib/upload/send';
import { OnboardingProgress } from '@/screens/onboarding/progress';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
lockPortrait();
if (Platform.OS === 'ios') Image.configureCache({ maxDiskSize: 262144000 });
export default function RootLayout() {
  const { name, color } = useTheme();
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
        <Startup />
      </AuthProvider>
    </ThemeProvider>
  );
}
function Startup() {
  const { status } = useAuth();
  const back = useEdgeBack(() => {
    if (router.canGoBack()) router.back();
  });
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_600SemiBold,
    Unbounded_700Bold,
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
  });
  const fontsSettled = fontsLoaded || fontError !== null;
  useEffect(() => {
    if (fontError) console.warn('fonts fail to load, the app opens in the system font:', fontError);
  }, [fontError]);
  useUploads();
  useLaunchUpdate();
  useEffect(() => {
    if (status !== 'loading' && fontsSettled) SplashScreen.hideAsync().catch(() => {});
  }, [status, fontsSettled]);
  return fontsSettled ? (
    <View style={styles.root} {...back}>
      <RootNavigator />
      <OnboardingProgress />
    </View>
  ) : null;
}
function RootNavigator() {
  const { status } = useAuth();
  usePush();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="index" options={{ title: 'Remember' }} />
        <Stack.Screen name="create" options={{ title: 'New memory' }} />

        <Stack.Screen name="memory/[id]" options={{ title: 'Memory' }} />

        <Stack.Screen name="memory/[id]/settings" options={{ title: 'Memory settings' }} />

        <Stack.Screen name="memory/[id]/edit" options={{ title: 'Edit the memory' }} />

        <Stack.Screen name="memory/[id]/mine" options={{ title: 'My frames' }} />
        <Stack.Screen name="memory/[id]/upload" options={{ title: 'Upload' }} />
        <Stack.Screen name="memory/[id]/queue" options={{ title: 'Upload queue' }} />

        <Stack.Screen name="memory/[id]/order" options={{ title: 'Order a movie' }} />

        <Stack.Screen
          name="memory/[id]/montage/[montageId]/index"
          options={{ title: 'Making a movie' }}
        />

        <Stack.Screen name="memory/[id]/montage/[montageId]/film" options={{ title: 'Movie' }} />

        <Stack.Screen
          name="memory/[id]/montage/[montageId]/stage/[stage]"
          options={{ title: 'The stage journal' }}
        />
        <Stack.Screen name="contacts" options={{ title: 'Contacts' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'needs-username'}>
        <Stack.Screen name="consent" options={{ title: 'Agreement' }} />
        <Stack.Screen name="set-username" options={{ title: 'Pick a username' }} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'signed-out' || status === 'loading'}>
        <Stack.Screen name="login" options={{ title: 'Sign in' }} />
        <Stack.Screen name="login/email" options={{ title: 'Sign in by email' }} />
        <Stack.Screen name="login/code" options={{ title: 'Code from the letter' }} />
      </Stack.Protected>

      <Stack.Screen name="invite" options={{ title: 'Invitation' }} />
    </Stack>
  );
}
const styles = StyleSheet.create({ root: { flex: 1 } });
