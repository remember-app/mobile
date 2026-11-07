import type { Login, Session } from '@/models';
import type { Page } from '@/types/api';
import type { SessionId } from '@/types/id';

import { query, request } from './client';
import { toLoginResult, toPage, toSession } from './map';
import type { LoginResultWire, LoginStartWire, OffsetPageWire, SessionWire } from './wire';

export function startEmailLogin(
  email: string,
): Promise<{ ok: true; registered: boolean; code?: string }> {
  return request<LoginStartWire>('/v1/auth/email/start', { method: 'POST', body: { email } });
}

export function verifyEmailCode(email: string, code: string): Promise<Login> {
  return request<LoginResultWire>('/v1/auth/email/verify', {
    method: 'POST',
    body: { email, code },
  }).then(toLoginResult);
}

export function logout(token: string): Promise<{ ok: true }> {
  return request('/v1/auth/logout', { method: 'POST', token });
}

export function listSessions(
  token: string,
  page: { limit?: number; offset?: number } = {},
): Promise<Page<Session>> {
  return request<OffsetPageWire<SessionWire>>(`/v1/auth/sessions${query(page)}`, { token }).then(
    (wire) => toPage(wire, toSession),
  );
}

export function revokeSession(token: string, sessionId: SessionId): Promise<{ ok: true }> {
  return request(`/v1/auth/sessions/${sessionId}/revoke`, { method: 'POST', token });
}
