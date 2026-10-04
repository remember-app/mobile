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

// Keychain (iOS) / EncryptedSharedPreferences (Android). Never AsyncStorage: that is plain text.
const TOKEN_KEY = 'session-token';

/**
 * The account as the api last said it, kept beside the token and nowhere else (TASK-513).
 *
 * The gate holds on the whole account, not on the token: `status` is ready only once there is a
 * `user`, so a launch that waits for `/me` before it has one is a launch with no signal that lands
 * on /login. The app opens on this copy instead and the api is asked underneath it.
 *
 * Read only beside a token, so a copy left without one opens nothing, and deleted in `forget()` with
 * the token — the one place either is dropped, so a copy cannot outlive the session it is about.
 */
const ACCOUNT_KEY = 'session-account';

/** The account this phone kept beside the token, or null where the keychain holds nothing. */
async function readAccount(): Promise<User | null> {
  const kept = await SecureStore.getItemAsync(ACCOUNT_KEY);
  return kept ? (JSON.parse(kept) as User) : null;
}

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
  /**
   * «Даты между днями» — the account's one setting for every feed (spec 8, `MemoryDated`). Read
   * here and not off `user`: a change in flight is already this value. Off until the account is read.
   */
  datesBetweenDays: boolean;
  /**
   * Change it on the account. Every feed turns at once; a refusal turns them back to what the api
   * holds and rejects with the api's error for the caller to show.
   */
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
  /**
   * What the latest change of «Даты между днями» asked for, until the api has answered it. `user`
   * only ever holds what the api said, so letting go of this is the whole of the rollback.
   */
  const [datesAsked, setDatesAsked] = useState<boolean | null>(null);
  const datesCall = useRef(0);
  const language = useLanguage();

  /**
   * The account as the api has just said it, kept on the phone beside the token so the next launch
   * can open on it (TASK-513). Off `user` and not written by hand at each call site: the copy is
   * whatever the screen is holding, so no path that moves the account — the sign-ins, the username,
   * «Даты между днями», the launch's own refresh — can leave the copy behind, and a path that
   * refuses to move the account cannot write one either.
   */
  useEffect(() => {
    if (!user) return;
    // Best effort: a keychain that will not take the copy costs the next launch its offline opening
    // and nothing else. Kept out of iCloud backups with the token, same reason as that one.
    SecureStore.setItemAsync(ACCOUNT_KEY, JSON.stringify(user), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }).catch((e) => console.warn('the account was not kept on this phone:', e));
  }, [user]);

  /**
   * The session gone from this phone, which is what the gate turns into /login. Out of the app
   * before out of the keychain: a poll that answered 401 is still on its way to its screen, and the
   * screen has to be gone by the time it would say «no connection». The account goes with the token
   * and nowhere else: a copy that outlived its token would open the app as somebody else.
   *
   * And the feeds this phone kept go with both (TASK-512, decision-23): the same argument one step
   * further, and the reason any code that ends a session asks `forget()` rather than reaching for
   * the token itself — a feed left behind would draw somebody else's photographs to whoever signs
   * in next.
   */
  const forget = useCallback(async () => {
    setToken(null);
    setUser(null);
    setDatesAsked(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(ACCOUNT_KEY);
    forgetKept();
  }, []);

  // Restore the stored session once at startup.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (stored) {
          const kept = await readAccount();
          // The gate opens on what this phone already holds, not on what the api answers: `status`
          // is `ready` only with an account, so a launch that waited for `/me` before it had one put
          // a signed-in person with no signal on /login (TASK-513). The api is asked underneath and
          // its answer lands on top of this one, or ends the session if it refuses the token.
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
            // Only a refusal kills the stored token. A network blip must not log the pilot out
            // for good — this launch stays on the copy, the next one with the api up refreshes it.
            if (error instanceof ApiError && error.status === 401) await forget();
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
  }, [forget]);

  /**
   * A token the api stopped honouring while the app was using it ends the session the way «Выйти»
   * does, less telling the api what the api has just said. Once: every poll in the air comes back
   * 401 at about the same moment, and the first of them is the one that acts. A refusal of any
   * other token — one being tried on the way in, one already dropped — is not this session's.
   */
  useEffect(() => {
    if (!token) return;
    let dropped = false;
    return onSessionRefused((refused) => {
      if (refused !== token || dropped) return;
      dropped = true;
      console.info('session ends: the api no longer honours its token');
      // ponytail: a keychain that will not let go keeps a dead token until the next launch, whose
      // own 401 on /me drops it — the app is already signed out either way.
      forget().catch((e) => console.warn('dead session token left in the keychain:', e));
    });
  }, [token, forget]);

  /**
   * Keep the account's language level with the app's. It runs as soon as there is a session —
   * carrying whatever the app settled on, the phone's answer or the pick read back off the disk —
   * and again on every switch by hand, because `useLanguage()` redraws this provider when the
   * language turns. Before a session there is nothing to attach it to; that case is the letter's,
   * and `startEmailSignIn` carries it there.
   *
   * Failures are dropped the way the push token's are: the language the person sees is the local
   * one and it has already turned, so an offline phone must not hold the switch or say a word
   * about it. The next launch, or the next switch, sends it again.
   */
  useEffect(() => {
    if (!token) return;
    putLanguage(token, language).catch(() => {});
  }, [token, language]);

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
        // Onto the account it was asked for only: signed out while this was in the air stays out.
        setUser((have) => (have?.id === me.id ? me : have));
      } finally {
        // An earlier change answering late leaves the latest one's ask standing.
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
