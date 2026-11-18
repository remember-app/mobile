import 'react-native-gesture-handler';

import { Onest_400Regular } from '@expo-google-fonts/onest/400Regular';
import { Onest_500Medium } from '@expo-google-fonts/onest/500Medium';
import { Onest_600SemiBold } from '@expo-google-fonts/onest/600SemiBold';
import { Onest_700Bold } from '@expo-google-fonts/onest/700Bold';
import { useFonts } from '@expo-google-fonts/onest/useFonts';
import { Unbounded_600SemiBold } from '@expo-google-fonts/unbounded/600SemiBold';
import { Unbounded_700Bold } from '@expo-google-fonts/unbounded/700Bold';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { LucideProvider } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { onPushOpened, sessionState, startApp, systemMediaState } from '@/functionality';
import { refreshScreen } from '@/functionality/screen-refresh';
import { readLanguage, writeLanguage } from '@/functionality/settings/language';
import { health } from '@/integrations/api';
import type { ProjectId } from '@/types/id';
import { maybeCloseOpenRows } from '@/ui/components/common/swipe-row';
import { NetworkBanner } from '@/ui/components/feedback/network-banner';
import { NoConnection } from '@/ui/components/feedback/no-connection';
import { useSession } from '@/ui/hooks';
import { applyLanguage } from '@/ui/i18n';
import { ScreenSkin } from '@/ui/kit/chrome/backdrop';
import { preloadWallpapers } from '@/ui/kit/internal/wallpaper';
import { useTheme } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

/** Route groups like `(account)` are invisible in the URL, so they must not reach the wallpaper. */
function withoutGroups(name: string): string {
  return name.replace(/\([^)]*\)\//g, '');
}

export default function RootLayout() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const accountLanguage = 'account' in session ? session.account.language : null;
  const [ready, setReady] = useState(false);
  const languageSynced = useRef(false);
  const [gate, setGate] = useState<'checking' | 'ready' | 'blocked'>('checking');
  const [attempt, setAttempt] = useState(0);
  const [loaded] = useFonts({
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
    Unbounded_600SemiBold,
    Unbounded_700Bold,
  });

  useEffect(() => {
    void Promise.all([startApp(), preloadWallpapers()]).finally(() => setReady(true));
    void readLanguage().then((stored) => {
      if (!languageSynced.current) void applyLanguage(stored);
    });
  }, []);

  useEffect(() => {
    if (!accountLanguage) return;
    languageSynced.current = true;
    void writeLanguage(accountLanguage);
    void applyLanguage(accountLanguage);
  }, [accountLanguage]);

  useEffect(() => {
    if (loaded && ready) void SplashScreen.hideAsync();
  }, [loaded, ready]);

  useEffect(() => {
    if (!loaded || !ready) return;
    let live = true;
    setGate('checking');
    health().then(
      () => {
        if (live) setGate('ready');
      },
      () => {
        if (!live) return;
        const cached = 'token' in sessionState() || systemMediaState().length > 0;
        setGate(cached ? 'ready' : 'blocked');
      },
    );
    return () => {
      live = false;
    };
  }, [loaded, ready, attempt]);

  useEffect(() => {
    return onPushOpened((payload) => {
      if (payload.projectId) {
        router.navigate({ pathname: '/project/[id]', params: { id: payload.projectId } });
      }
    });
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    refreshScreen(pathname);
  }, [pathname, ready]);

  if (!loaded || !ready) return null;

  const base = theme.name === 'dark' ? DarkTheme : DefaultTheme;
  const navigation = {
    ...base,
    colors: { ...base.colors, background: 'transparent', card: theme.color.ink },
  };

  return (
    <KeyboardProvider>
      <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.color.ink }]}>
        <LucideProvider strokeWidth={2.2}>
          <SafeAreaProvider>
            <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
            <ThemeProvider value={navigation}>
              <View
                style={styles.root}
                onStartShouldSetResponderCapture={(event) => {
                  maybeCloseOpenRows(event.nativeEvent.pageX, event.nativeEvent.pageY);
                  return false;
                }}
              >
                {gate === 'checking' ? null : gate === 'blocked' ? (
                  <NoConnection onRetry={() => setAttempt((value) => value + 1)} />
                ) : (
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      animation: 'slide_from_right',
                      animationDuration: 220,
                      contentStyle: { backgroundColor: 'transparent' },
                    }}
                    screenLayout={({ route, children }) => (
                      <ScreenSkin
                        routeName={withoutGroups(route.name)}
                        projectId={(route.params as { id?: ProjectId } | undefined)?.id}
                      >
                        {children}
                      </ScreenSkin>
                    )}
                  />
                )}
                <NetworkBanner />
              </View>
            </ThemeProvider>
          </SafeAreaProvider>
        </LucideProvider>
      </GestureHandlerRootView>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
