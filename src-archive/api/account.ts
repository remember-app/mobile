import { currentLanguage, type Language } from '@/lib/language';
import { request } from './call';
export type User = {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  dates_between_days: boolean;
};
export type Session = {
  token: string;
  user: User;
};
export function startEmailSignIn(email: string): Promise<{
  ok: true;
  code?: string;
}> {
  return request('/auth/email/start', {
    method: 'POST',
    body: { email, language: currentLanguage() },
  });
}
export function verifyEmailCode(email: string, code: string): Promise<Session> {
  return request('/auth/email/verify', { method: 'POST', body: { email, code } });
}
export function acceptConsent(token: string): Promise<{
  accepted_at: string;
}> {
  return request('/me/consent', { method: 'POST', token });
}
export type AuthMethods = {
  email: boolean;
  apple: boolean;
  google: boolean;
};
export function fetchAuthMethods(): Promise<AuthMethods> {
  return request('/auth/methods');
}
export function signInWithApple(idToken: string): Promise<Session> {
  return request('/auth/apple', { method: 'POST', body: { idToken } });
}
export function signInWithGoogle(idToken: string): Promise<Session> {
  return request('/auth/google', { method: 'POST', body: { idToken } });
}
export function fetchMe(token: string): Promise<User> {
  return request('/me', { token });
}
export function putUsername(token: string, username: string): Promise<User> {
  return request('/me/username', { method: 'POST', body: { username }, token });
}
export function putLanguage(token: string, language: Language): Promise<User> {
  return request('/me/language', { method: 'POST', body: { language }, token });
}
export function putDatesBetweenDays(token: string, on: boolean): Promise<User> {
  return request('/me/dates-between-days', {
    method: 'POST',
    body: { dates_between_days: on },
    token,
  });
}
export function checkUsername(
  token: string,
  username: string,
): Promise<{
  available: boolean;
}> {
  return request(`/me/username/available?username=${encodeURIComponent(username)}`, { token });
}
export function endSession(token: string): Promise<{
  ok: true;
}> {
  return request('/auth/logout', { method: 'POST', token });
}
const USERNAME = /^[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]$/;
export function isValidUsername(username: string): boolean {
  return USERNAME.test(username);
}
