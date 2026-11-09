import { currentToken, onSignOut, refreshSession } from '@/functionality/auth/session';
import {
  acceptInvite as apiAcceptInvite,
  createAppInvite as apiCreateAppInvite,
  getProjectInvite,
  rotateProjectInvite,
} from '@/integrations/api';
import type { AppInvite, JoinResult, ProjectInvite, Role } from '@/models';
import type { ProjectId } from '@/types/id';
import { upsertProjectCard } from './projects';

export type InviteState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  invite: ProjectInvite | null;
  error: unknown;
};

const EMPTY: InviteState = { status: 'idle', invite: null, error: null };
const states = new Map<ProjectId, InviteState>();

let pending: string | null = null;

export function stashInvite(token: string): void {
  pending = token;
}

export function pendingInvite(): string | null {
  return pending;
}

export function clearPendingInvite(): void {
  pending = null;
}
const listeners = new Set<() => void>();

export const inviteState = (projectId: ProjectId): InviteState => states.get(projectId) ?? EMPTY;

export const subscribeInvites = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(projectId: ProjectId, next: InviteState): void {
  states.set(projectId, next);
  for (const listener of listeners) listener();
}

function token(): string {
  const value = currentToken();
  if (!value) throw new Error('not signed in');
  return value;
}

export function clearInvites(): void {
  states.clear();
  for (const listener of listeners) listener();
}

export async function loadInvite(projectId: ProjectId): Promise<ProjectInvite> {
  emit(projectId, { ...inviteState(projectId), status: 'loading', error: null });
  try {
    const invite = await getProjectInvite(token(), projectId);
    emit(projectId, { status: 'ready', invite, error: null });
    return invite;
  } catch (error) {
    emit(projectId, { ...inviteState(projectId), status: 'error', error });
    throw error;
  }
}

export async function rotateInvite(
  projectId: ProjectId,
  input: { role?: Role; maxUses?: number | null } = {},
): Promise<ProjectInvite> {
  emit(projectId, { ...inviteState(projectId), status: 'loading', error: null });
  try {
    const invite = await rotateProjectInvite(token(), projectId, input);
    emit(projectId, { status: 'ready', invite, error: null });
    return invite;
  } catch (error) {
    emit(projectId, { ...inviteState(projectId), status: 'error', error });
    throw error;
  }
}

export async function createAppInvite(
  input: { maxUses?: number | null; expiresAt?: string | null } = {},
): Promise<AppInvite> {
  return apiCreateAppInvite(token(), input);
}

export async function acceptInvite(inviteToken: string): Promise<JoinResult> {
  const result = await apiAcceptInvite(token(), inviteToken);
  if ('project' in result) upsertProjectCard(result.project);
  else await refreshSession();
  return result;
}

onSignOut(clearInvites);
