import { loadAvatar } from '@/functionality/account/avatar';
import { loadAnalysisJobs } from '@/functionality/analysis/jobs';
import { refreshSession } from '@/functionality/auth/session';
import { loadContacts } from '@/functionality/contact/contacts';
import { loadLabels } from '@/functionality/label/labels';
import { loadGallery } from '@/functionality/media/gallery';
import { loadMontages } from '@/functionality/montage/montages';
import { loadMovies } from '@/functionality/movie/movies';
import { loadMembers } from '@/functionality/project/members';
import { loadProjects } from '@/functionality/project/projects';
import { loadOwnSongs } from '@/functionality/song/mine';
import { loadLibrarySongs, loadProjectSongs } from '@/functionality/song/songs';
import type { ProjectId } from '@/types/id';

const MINUTE = 60_000;
const lastRun = new Map<string, number>();
const running = new Set<string>();

function once(key: string, run: () => Promise<unknown>): void {
  const now = Date.now();
  if (running.has(key) || now - (lastRun.get(key) ?? 0) < MINUTE) return;
  running.add(key);
  void run()
    .then(() => lastRun.set(key, Date.now()))
    .catch(() => undefined)
    .finally(() => running.delete(key));
}

export function refreshScreen(pathname: string): void {
  once('session', () => refreshSession());

  if (pathname === '/' || pathname === '/home' || pathname === '/create') {
    once('projects', () => loadProjects(true));
    once('avatar', () => loadAvatar());
  }
  if (pathname === '/create' || pathname.startsWith('/contacts')) {
    once('contacts', () => loadContacts(true));
  }
  if (pathname.startsWith('/profile')) {
    once('avatar', () => loadAvatar());
    once('contacts', () => loadContacts(true));
    once('own-songs', () => loadOwnSongs());
  }
  if (pathname === '/songs') {
    once('own-songs', () => loadOwnSongs(true));
  }
  if (pathname.endsWith('/new-montage')) {
    once('library-songs', () => loadLibrarySongs(true));
  }
  if (!pathname.startsWith('/project/')) return;

  const projectId = pathname.split('/')[2];
  if (!projectId) return;
  const id = projectId as ProjectId;

  once('projects', () => loadProjects(true));
  once('avatar', () => loadAvatar());
  once(`gallery:${id}`, () => loadGallery(id, true));
  once(`labels:${id}`, () => loadLabels(id, true));
  once(`members:${id}`, () => loadMembers(id, true));
  once(`montages:${id}`, () => loadMontages(id, true));
  once(`movies:${id}`, () => loadMovies(id, true));
  once(`songs:${id}`, () => loadProjectSongs(id, true));
  once(`analysis:${id}`, () => loadAnalysisJobs(id));
}
