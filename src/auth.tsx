import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ApiError, endSession, fetchMe, putUsername, type User } from '@/api';

// Keychain (iOS) / EncryptedSharedPreferences (Android). Never AsyncStorage: that is plain text.
const TOKEN_KEY = 'session-token';

/**
 * Where the session stands. `token` and `user` always move together, so anything other
 * than `loading` is a settled answer about what the app may show.
 */
export type AuthStatus = 'loading' | 'signed-out' | 'needs-username' | 'ready';

type Auth = {
  token: string | null;
  user: User | null;
  status: AuthStatus;
  /** Store a freshly issued session token and load the account behind it. Throws if the api refuses it. */
  signIn: (sessionToken: string) => Promise<void>;
  /** Drop the session here and, best effort, on the api. */
  signOut: () => Promise<void>;
  /** Claim or change the username. Throws ApiError 409 (taken) / 400 (format) for the caller to show. */
  setUsername: (username: string) => Promise<void>;
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

  // Restore the stored session once at startup.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (stored) {
          try {
            const me = await fetchMe(stored);
            if (live) {
              setToken(stored);
              setUser(me);
            }
          } catch (error) {
            // Only a refusal kills the stored token. A network blip must not log the pilot out
            // for good — this launch lands on /login, the next one with the api up restores it.
            if (error instanceof ApiError && error.status === 401) {
              await SecureStore.deleteItemAsync(TOKEN_KEY);
            }
          }
        }
      } catch {
        // Unreadable keychain: nothing to restore, carry on signed out.
      }
      if (live) setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, []);

  const signIn = useCallback(async (sessionToken: string) => {
    // Load the account first: a token the api will not honour never reaches the keychain.
    const me = await fetchMe(sessionToken);
    // THIS_DEVICE_ONLY keeps the session out of iCloud backups, so restoring a backup
    // onto another device does not hand it a live session.
    await SecureStore.setItemAsync(TOKEN_KEY, sessionToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    setToken(sessionToken);
    setUser(me);
  }, []);

  const signOut = useCallback(async () => {
    // Best effort: the local session goes whether or not the api hears about it.
    if (token) await endSession(token).catch(() => {});
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const setUsername = useCallback(
    async (username: string) => {
      if (!token) throw new Error('not signed in');
      setUser(await putUsername(token, username));
    },
    [token],
  );

  const status: AuthStatus = loading
    ? 'loading'
    : !user
      ? 'signed-out'
      : user.username === null
        ? 'needs-username'
        : 'ready';

  const value = useMemo(
    () => ({ token, user, status, signIn, signOut, setUsername }),
    [token, user, status, signIn, signOut, setUsername],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
