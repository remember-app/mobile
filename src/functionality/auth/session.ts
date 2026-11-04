import {
  setName as apiSetName,
  setUsername as apiSetUsername,
  getMe,
  isApiError,
  logout,
  onSessionRefused,
  startEmailLogin,
  verifyEmailCode,
} from '@/integrations/api';
import { clearCache } from '@/integrations/files/cache';
import { readSecret, removeSecret, writeSecret } from '@/integrations/secure';
import type { Account, Login } from '@/models';

const TOKEN_KEY = 'session-token';
const ACCOUNT_KEY = 'session-account';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'needs-username'; token: string; account: Account }
  | { status: 'signed-in'; token: string; account: Account };

let state: SessionState = { status: 'loading' };
const listeners = new Set<() => void>();
const signOutListeners = new Set<() => void>();
const beforeSignOutListeners = new Set<() => void | Promise<void>>();

export function onSignOut(listener: () => void): () => void {
  signOutListeners.add(listener);
  return () => {
    signOutListeners.delete(listener);
  };
}

export function onBeforeSignOut(listener: () => void | Promise<void>): () => void {
  beforeSignOutListeners.add(listener);
  return () => {
    beforeSignOutListeners.delete(listener);
  };
}

function emit(next: SessionState): void {
  state = next;
  for (const listener of listeners) listener();
}

export const sessionState = (): SessionState => state;

export const subscribeSession = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const currentToken = (): string | undefined => ('token' in state ? state.token : undefined);

function withAccount(token: string, account: Account): SessionState {
  return account.username === null
    ? { status: 'needs-username', token, account }
    : { status: 'signed-in', token, account };
}

async function keep(token: string, account: Account): Promise<void> {
  emit(withAccount(token, account));
  await Promise.all([
    writeSecret(TOKEN_KEY, token),
    writeSecret(ACCOUNT_KEY, JSON.stringify(account)),
  ]);
}

async function forget(): Promise<void> {
  emit({ status: 'signed-out' });
  for (const listener of signOutListeners) listener();
  clearCache();
  await Promise.allSettled([removeSecret(TOKEN_KEY), removeSecret(ACCOUNT_KEY)]);
}

function keptAccount(raw: string | null): Account | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Account;
  } catch {
    return null;
  }
}

export async function restoreSession(): Promise<void> {
  let token: string | null;
  let raw: string | null;
  try {
    [token, raw] = await Promise.all([readSecret(TOKEN_KEY), readSecret(ACCOUNT_KEY)]);
  } catch (error) {
    console.warn('session could not be read from the keychain:', error);
    emit({ status: 'signed-out' });
    return;
  }
  if (!token) {
    emit({ status: 'signed-out' });
    return;
  }
  const account = keptAccount(raw);
  if (account) emit(withAccount(token, account));
  try {
    await keep(token, await getMe(token));
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      await forget();
    } else if (!account) {
      emit({ status: 'signed-out' });
    }
  }
}

export async function signIn(token: string): Promise<void> {
  await keep(token, await getMe(token));
}

export async function requestCode(email: string): Promise<{ code?: string }> {
  return startEmailLogin(email);
}

export async function confirmCode(email: string, code: string): Promise<void> {
  const login: Login = await verifyEmailCode(email, code);
  await signIn(login.token);
}

export async function signOut(): Promise<void> {
  const token = currentToken();
  for (const listener of beforeSignOutListeners) {
    try {
      await listener();
    } catch (error) {
      console.warn('a sign-out step failed:', error);
    }
  }
  if (token) await logout(token).catch(() => undefined);
  await forget();
}

export async function refreshSession(): Promise<void> {
  const token = currentToken();
  if (!token) return;
  await keep(token, await getMe(token));
}

export async function setUsername(username: string): Promise<void> {
  const token = currentToken();
  if (!token || !('account' in state)) throw new Error('not signed in');
  const user = await apiSetUsername(token, username);
  await keep(token, { ...state.account, ...user });
}

export async function setName(name: string | null): Promise<void> {
  const token = currentToken();
  if (!token || !('account' in state)) throw new Error('not signed in');
  const user = await apiSetName(token, name);
  await keep(token, { ...state.account, ...user });
}

onSessionRefused((refused) => {
  if (currentToken() === refused) void forget();
});
