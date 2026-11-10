import { currentToken, onSignOut, sessionState } from '@/functionality/auth/session';
import {
  addMember as apiAddMember,
  removeMember as apiRemoveMember,
  setContribution as apiSetContribution,
  setMemberRole as apiSetMemberRole,
  listMembers,
} from '@/integrations/api';
import { readCache, removeCache, writeCache } from '@/integrations/files/cache';
import type { Contribution, Member, Role } from '@/models';
import type { ProjectId, UserId } from '@/types/id';
import { adjustProjectCounts, onProjectDeleted } from './projects';

export type MembersState = {
  status: 'loading' | 'ready' | 'error';
  members: Member[];
  nextOffset: number | null;
  error: unknown;
};

type Stored = {
  members: Member[];
  nextOffset: number | null;
};

const EMPTY: MembersState = {
  status: 'loading',
  members: [],
  nextOffset: null,
  error: null,
};

const states = new Map<ProjectId, MembersState>();
const inFlight = new Map<ProjectId, Promise<void>>();
const listeners = new Set<() => void>();

const cacheName = (projectId: ProjectId) => `members-${projectId}`;
const terminal = (contribution: Contribution) => contribution === 'done';

export const membersState = (projectId: ProjectId): MembersState => states.get(projectId) ?? EMPTY;

export const subscribeMembers = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(projectId: ProjectId, next: MembersState): void {
  states.set(projectId, next);
  for (const listener of listeners) listener();
}

function persist(projectId: ProjectId): void {
  const current = membersState(projectId);
  writeCache(cacheName(projectId), { members: current.members, nextOffset: current.nextOffset });
}

function token(): string {
  const value = currentToken();
  if (!value) throw new Error('not signed in');
  return value;
}

function order(members: Member[]): Member[] {
  return [...members].sort(
    (left, right) =>
      left.joinedAt.getTime() - right.joinedAt.getTime() || left.userId.localeCompare(right.userId),
  );
}

export function hydrateMembers(projectId: ProjectId): void {
  const stored = readCache<Stored>(cacheName(projectId));
  if (!stored || !Array.isArray(stored.members)) return;
  emit(projectId, {
    status: 'ready',
    members: stored.members.map((member) => ({
      ...member,
      joinedAt: new Date(member.joinedAt),
    })),
    nextOffset: stored.nextOffset,
    error: null,
  });
}

export function clearMembers(): void {
  states.clear();
  for (const listener of listeners) listener();
}

export function forgetMembers(projectId: ProjectId): void {
  states.delete(projectId);
  removeCache(cacheName(projectId));
  for (const listener of listeners) listener();
}

export function memberById(projectId: ProjectId, userId: UserId): Member | undefined {
  return membersState(projectId).members.find((member) => member.userId === userId);
}

export function myMembership(projectId: ProjectId): Member | undefined {
  const current = sessionState();
  return 'account' in current ? memberById(projectId, current.account.id) : undefined;
}

export async function loadMembers(projectId: ProjectId, force = false): Promise<void> {
  const running = inFlight.get(projectId);
  if (running) return running;
  if (!force && membersState(projectId).status === 'ready') return;
  const run = (async () => {
    try {
      const page = await listMembers(token(), projectId);
      emit(projectId, {
        status: 'ready',
        members: page.items,
        nextOffset: page.nextOffset,
        error: null,
      });
      persist(projectId);
    } catch (error) {
      emit(projectId, {
        ...membersState(projectId),
        status: membersState(projectId).members.length > 0 ? 'ready' : 'error',
        error,
      });
    } finally {
      inFlight.delete(projectId);
    }
  })();
  inFlight.set(projectId, run);
  return run;
}

export async function loadMoreMembers(projectId: ProjectId): Promise<void> {
  const running = inFlight.get(projectId);
  if (running) return running;
  const current = membersState(projectId);
  if (current.nextOffset === null) return;
  const run = (async () => {
    try {
      const page = await listMembers(token(), projectId, {
        offset: current.nextOffset ?? undefined,
      });
      const seen = new Set(current.members.map((member) => member.userId));
      emit(projectId, {
        status: 'ready',
        members: [...current.members, ...page.items.filter((member) => !seen.has(member.userId))],
        nextOffset: page.nextOffset,
        error: null,
      });
      persist(projectId);
    } catch (error) {
      emit(projectId, { ...membersState(projectId), error });
    } finally {
      inFlight.delete(projectId);
    }
  })();
  inFlight.set(projectId, run);
  return run;
}

export async function addMember(
  projectId: ProjectId,
  username: string,
  role: Role,
): Promise<Member> {
  const member = await apiAddMember(token(), projectId, { username, role });
  const current = membersState(projectId);
  const exists = current.members.some((item) => item.userId === member.userId);
  if (current.status !== 'ready') {
    if (!exists) adjustProjectCounts(projectId, { members: 1 });
    await loadMembers(projectId, true);
    return member;
  }
  emit(projectId, {
    ...current,
    members: order(
      exists
        ? current.members.map((item) => (item.userId === member.userId ? member : item))
        : [...current.members, member],
    ),
    error: null,
  });
  persist(projectId);
  if (!exists) adjustProjectCounts(projectId, { members: 1 });
  return member;
}

export async function setRole(projectId: ProjectId, userId: UserId, role: Role): Promise<Member> {
  const member = await apiSetMemberRole(token(), projectId, userId, role);
  const current = membersState(projectId);
  if (current.status === 'ready') {
    emit(projectId, {
      ...current,
      members: current.members.map((item) => (item.userId === userId ? member : item)),
    });
    persist(projectId);
  }
  return member;
}

export async function removeMember(projectId: ProjectId, userId: UserId): Promise<void> {
  const removed = memberById(projectId, userId);
  await apiRemoveMember(token(), projectId, userId);
  const current = membersState(projectId);
  if (current.status === 'ready') {
    emit(projectId, {
      ...current,
      members: current.members.filter((member) => member.userId !== userId),
    });
    persist(projectId);
  }
  adjustProjectCounts(projectId, {
    members: -1,
    shared: removed && terminal(removed.contribution) ? -1 : 0,
  });
}

export async function setContribution(
  projectId: ProjectId,
  status: Contribution,
): Promise<Contribution> {
  const current = sessionState();
  const userId = 'account' in current ? current.account.id : undefined;
  const before = userId ? memberById(projectId, userId)?.contribution : undefined;
  const contribution = await apiSetContribution(token(), projectId, status);
  if (userId) {
    const state = membersState(projectId);
    if (state.status === 'ready') {
      emit(projectId, {
        ...state,
        members: state.members.map((member) =>
          member.userId === userId ? { ...member, contribution } : member,
        ),
      });
      persist(projectId);
    }
    const delta = Number(terminal(contribution)) - Number(before !== undefined && terminal(before));
    if (delta !== 0) adjustProjectCounts(projectId, { shared: delta });
  }
  return contribution;
}

onSignOut(clearMembers);
onProjectDeleted(forgetMembers);
