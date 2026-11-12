import { readSecret, writeSecret } from '@/integrations/secure';

import {
  createMockMontage,
  MOCK_PROJECT_ID,
  mockAccount,
  mockBundles,
  mockProjects,
  mockSongs,
  mockTemplates,
  mockUsers,
} from './fixtures';

const KEY = 'mock-mode';

let on = false;
let started: Promise<void> | null = null;
let active = mockAccount;

export async function initMockMode(): Promise<void> {
  if (!started) {
    started = readSecret(KEY)
      .then((value) => {
        on = value === '1';
      })
      .catch(() => {
        on = false;
      });
  }
  return started;
}

export const mockMode = (): boolean => on;

export async function setMockMode(value: boolean): Promise<void> {
  on = value;
  if (value) active = mockAccount;
  started = Promise.resolve();
  await writeSecret(KEY, value ? '1' : '0');
}

const empty = { items: [], nextOffset: null };
const invite = { token: 'MOCK01', role: 'contributor' as const };

const bundleOf = (projectId: string) => mockBundles[projectId];

const findItem = (projectId: string, itemId: string) =>
  bundleOf(projectId)?.gallery.items.find((one) => one.item.id === itemId);

const findMontage = (projectId: string, montageId: string) =>
  bundleOf(projectId)?.montages.find((one) => one.id === montageId);

const findMovie = (projectId: string, movieId: string) =>
  bundleOf(projectId)?.movies.find((one) => one.id === movieId);

export function mockResponse(method: string, path: string, body?: unknown): unknown | undefined {
  const plain = path.split('?')[0] ?? path;
  if (plain === '/health') return { status: 'ok' };
  const url = plain.replace(/^\/v1/, '');
  const payload = (body ?? {}) as Record<string, unknown>;
  const parts = url.split('/').filter(Boolean);

  if (method === 'GET') {
    if (url === '/me') return active;
    if (url === '/dev/users') return mockUsers;
    if (url === '/me/avatar') return { url: null };
    if (url === '/auth/sessions') return empty;
    if (url === '/me/contacts' || url === '/me/contacts/suggestions') return empty;
    if (url === '/me/username/available') return { available: true };
    if (url === '/system/media') return { items: [] };
    if (url === '/songs/library') return { items: mockSongs, nextOffset: null };
    if (url === '/projects') return { items: mockProjects, nextOffset: null };
    if (parts[0] === 'projects' && parts.length === 2) return bundleOf(parts[1] ?? '')?.project;
    if (parts[0] === 'projects' && parts[2] === 'gallery') {
      return bundleOf(parts[1] ?? '')?.gallery ?? { items: [], nextCursor: null };
    }
    if (parts[0] === 'projects' && parts[2] === 'items' && parts[3]) {
      return findItem(parts[1] ?? '', parts[3]);
    }
    if (parts[0] === 'projects' && parts[2] === 'members') {
      return { items: bundleOf(parts[1] ?? '')?.members ?? [], nextOffset: null };
    }
    if (parts[0] === 'projects' && parts[2] === 'labels') {
      return { items: bundleOf(parts[1] ?? '')?.labels ?? [], nextOffset: null };
    }
    if (parts[0] === 'projects' && parts[2] === 'songs') {
      return { items: mockSongs, nextOffset: null };
    }
    if (parts[0] === 'projects' && parts[2] === 'montage-templates') return mockTemplates;
    if (parts[0] === 'projects' && parts[2] === 'invite') return invite;
    if (parts[0] === 'projects' && parts[2] === 'montages' && parts[3]) {
      return findMontage(parts[1] ?? '', parts[3]);
    }
    if (parts[0] === 'projects' && parts[2] === 'montages') {
      return { items: bundleOf(parts[1] ?? '')?.montages ?? [], nextOffset: null };
    }
    if (parts[0] === 'projects' && parts[2] === 'movies' && parts[3]) {
      return findMovie(parts[1] ?? '', parts[3]);
    }
    if (parts[0] === 'projects' && parts[2] === 'movies') {
      return { items: bundleOf(parts[1] ?? '')?.movies ?? [], nextOffset: null };
    }
    return undefined;
  }

  if (method === 'POST') {
    if (parts[0] === 'projects' && parts[2] === 'analyze') {
      const ids = Array.isArray(payload.itemIds) ? payload.itemIds : [];
      return { queued: ids.length, tokens: 0 };
    }
    if (url === '/auth/email/start') return { ok: true, code: '123456', registered: true };
    if (url === '/auth/email/verify') {
      const email = typeof payload.email === 'string' ? payload.email : active.email;
      active = mockUsers.find((user) => user.email === email) ?? mockAccount;
      return { token: 'mock-token', user: active };
    }
    if (url === '/auth/logout') return { ok: true };
    if (parts[0] === 'auth' && parts[1] === 'sessions' && parts[3] === 'revoke')
      return { ok: true };
    if (url === '/me/push-tokens') return { ok: true };
    if (url === '/invites/app') return { token: 'MOCK01', maxUses: null };
    if (url === '/invites/accept') {
      return bundleOf(String(payload.token ?? ''))?.project ?? mockProjects[0];
    }
    if (url === '/me/contacts') {
      const bob = mockBundles[MOCK_PROJECT_ID]?.members[1];
      return bob
        ? { id: bob.userId, username: bob.username, name: bob.name, profileMediaId: null }
        : undefined;
    }
    if (parts[0] === 'projects' && parts[2] === 'montages' && parts[4] === 'retry') {
      const found = findMontage(parts[1] ?? '', parts[3] ?? '');
      if (!found) return undefined;
      if (found.status === 'failed') {
        found.status = 'queued';
        found.error = null;
      }
      return found;
    }
    if (parts[0] === 'projects' && parts[2] === 'montages' && parts[3] === 'preview') {
      const bundle = bundleOf(parts[1] ?? '');
      const config = (payload.config ?? {}) as { includeItemIds?: string[] };
      const picked = new Set(config.includeItemIds ?? []);
      const tokens =
        bundle?.gallery.items.filter((one) => picked.has(one.item.id) && one.item.analysis === null)
          .length ?? 0;
      return { problems: [], tokens };
    }
    if (parts[0] === 'projects' && parts[2] === 'montages') {
      const config = (payload.config ?? {}) as {
        targetSeconds: number;
        prompt: string | null;
        dimensions: { width: number; height: number };
        musicIds: string[];
        includeItemIds: string[];
        name?: string | null;
      };
      return createMockMontage(parts[1] ?? '', config, config.name ?? null);
    }
    if (parts[0] === 'projects' && parts[2] === 'contribution') {
      return { status: payload.status ?? 'done' };
    }
    if (parts[0] === 'projects' && parts[2] === 'members') {
      return bundleOf(parts[1] ?? '')?.members[1];
    }
    if (parts[0] === 'projects' && parts[2] === 'labels' && parts[4] === 'items') {
      return { attached: 1 };
    }
    if (parts[0] === 'projects' && parts[2] === 'labels') {
      return bundleOf(parts[1] ?? '')?.labels[0];
    }
    if (parts[0] === 'projects' && parts[2] === 'invite') return invite;
    return { ok: true };
  }

  if (method === 'PATCH') {
    if (parts[0] === 'projects' && parts[2] === 'movies' && parts[3]) {
      const found = findMovie(parts[1] ?? '', parts[3]);
      return found ? { ...found, name: payload.name ?? found.name } : undefined;
    }
    if (parts[0] === 'projects' && parts[2] === 'items' && parts[3]) {
      const found = findItem(parts[1] ?? '', parts[3]);
      return found
        ? { ...found, item: { ...found.item, description: payload.description ?? null } }
        : undefined;
    }
    if (parts[0] === 'projects' && parts[2] === 'members' && parts[3]) {
      const found = bundleOf(parts[1] ?? '')?.members.find((one) => one.userId === parts[3]);
      return found ? { ...found, role: payload.role ?? found.role } : undefined;
    }
    return bundleOf(parts[1] ?? '')?.project ?? { ok: true };
  }

  if (method === 'DELETE') return { ok: true };
  return undefined;
}
