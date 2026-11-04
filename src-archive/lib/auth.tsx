import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ApiError,
  endSession,
  fetchMe,
  onSessionRefused,
  putDatesBetweenDays,
  putLanguage,
  putUsername,
  type User,
} from '@/api';
import { forgetKept } from '@/lib/frames-kept';
import { useLanguage } from '@/lib/language';

const TOKEN_KEY = 'session-token';
const ACCOUNT_KEY = 'session-account';
async function readAccount(): Promise<User | null> {
  const kept = await SecureStore.getItemAsync(ACCOUNT_KEY);
  return kept ? (JSON.parse(kept) as User) : null;
}
export type AuthStatus = 'loading' | 'signed-out' | 'needs-username' | 'ready';
type Auth = {
  token: string | null;
  user: User | null;
  status: AuthStatus;
  signIn: (sessionToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUsername: (username: string) => Promise<void>;
  datesBetweenDays: boolean;
  setDatesBetweenDays: (on: boolean) => Promise<void>;
};
const AuthContext = createContext<Auth | null>(null);
export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth() needs an <AuthProvider> above it');
  return auth;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [datesAsked, setDatesAsked] = useState<boolean | null>(null);
  const datesCall = useRef(0);
  const language = useLanguage();
  useEffect(() => {
    if (!user) return;
    SecureStore.setItemAsync(ACCOUNT_KEY, JSON.stringify(user), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }).catch((e) => console.warn('the account was not kept on this phone:', e));
  }, [user]);
  const forget = useCallback(async () => {
    setToken(null);
    setUser(null);
    setDatesAsked(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(ACCOUNT_KEY);
    forgetKept();
  }, []);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (stored) {
          const kept = await readAccount();
          if (kept && live) {
            setToken(stored);
            setUser(kept);
            setLoading(false);
          }
          try {
            const me = await fetchMe(stored);
            if (live) {
              setToken(stored);
              setUser(me);
            }
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) await forget();
          }
        }
      } catch {}
      if (live) setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [forget]);
  useEffect(() => {
    if (!token) return;
    let dropped = false;
    return onSessionRefused((refused) => {
      if (refused !== token || dropped) return;
      dropped = true;
      console.info('session ends: the api no longer honours its token');
      forget().catch((e) => console.warn('dead session token left in the keychain:', e));
    });
  }, [token, forget]);
  useEffect(() => {
    if (!token) return;
    putLanguage(token, language).catch(() => {});
  }, [token, language]);
  const signIn = useCallback(async (sessionToken: string) => {
    const me = await fetchMe(sessionToken);
    await SecureStore.setItemAsync(TOKEN_KEY, sessionToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    setToken(sessionToken);
    setUser(me);
  }, []);
  const signOut = useCallback(async () => {
    if (token) await endSession(token).catch(() => {});
    await forget();
  }, [token, forget]);
  const setUsername = useCallback(
    async (username: string) => {
      if (!token) throw new Error('not signed in');
      setUser(await putUsername(token, username));
    },
    [token],
  );
  const setDatesBetweenDays = useCallback(
    async (on: boolean) => {
      if (!token) throw new Error('not signed in');
      const call = ++datesCall.current;
      setDatesAsked(on);
      try {
        const me = await putDatesBetweenDays(token, on);
        setUser((have) => (have?.id === me.id ? me : have));
      } finally {
        if (call === datesCall.current) setDatesAsked(null);
      }
    },
    [token],
  );
  const datesBetweenDays = datesAsked ?? user?.dates_between_days ?? false;
  const status: AuthStatus = loading
    ? 'loading'
    : !user
      ? 'signed-out'
      : user.username === null
        ? 'needs-username'
        : 'ready';
  const value = useMemo(
    () => ({
      token,
      user,
      status,
      signIn,
      signOut,
      setUsername,
      datesBetweenDays,
      setDatesBetweenDays,
    }),
    [token, user, status, signIn, signOut, setUsername, datesBetweenDays, setDatesBetweenDays],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
