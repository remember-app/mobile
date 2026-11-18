import { onSignOut, requireToken } from '@/functionality/auth/session';
import { setItemAnalyses } from '@/functionality/media/gallery';
import { type AnalysisJob, listAnalysisJobs as apiListAnalysisJobs } from '@/integrations/api';
import type { ProjectId, ProjectItemId } from '@/types/id';

export type AnalysisJobsState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  items: AnalysisJob[];
  error: unknown;
};

const EMPTY: AnalysisJobsState = { status: 'idle', items: [], error: null };
const POLL_MS = 3000;

const states = new Map<ProjectId, AnalysisJobsState>();
const applied = new Map<ProjectId, Set<ProjectItemId>>();
const listeners = new Set<() => void>();

type Watch = { count: number; keep: number; timer: ReturnType<typeof setTimeout> | null };
const watches = new Map<ProjectId, Watch>();
const loads = new Map<ProjectId, Promise<AnalysisJob[]>>();

export const analysisJobsState = (projectId: ProjectId): AnalysisJobsState =>
  states.get(projectId) ?? EMPTY;

export const subscribeAnalysisJobs = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(projectId: ProjectId, next: AnalysisJobsState): void {
  states.set(projectId, next);
  for (const listener of listeners) listener();
}

const live = (job: AnalysisJob): boolean => job.status === 'queued' || job.status === 'running';

export function loadAnalysisJobs(projectId: ProjectId): Promise<AnalysisJob[]> {
  const running = loads.get(projectId);
  if (running) return running;
  const request = fetchAnalysisJobs(projectId).finally(() => loads.delete(projectId));
  loads.set(projectId, request);
  return request;
}

async function fetchAnalysisJobs(projectId: ProjectId): Promise<AnalysisJob[]> {
  const current = analysisJobsState(projectId);
  if (current.items.length === 0) emit(projectId, { ...current, status: 'loading', error: null });
  try {
    const answer = await apiListAnalysisJobs(requireToken(), projectId);
    const known = applied.get(projectId) ?? new Set<ProjectItemId>();
    const described = answer.items.flatMap((job) => {
      const itemId = job.itemId as ProjectItemId;
      if (job.status !== 'done' || !job.analysis || known.has(itemId)) return [];
      known.add(itemId);
      return [{ itemId, analysis: job.analysis }];
    });
    if (described.length > 0) {
      applied.set(projectId, known);
      setItemAnalyses(projectId, described);
    }
    emit(projectId, { status: 'ready', items: answer.items, error: null });
    return answer.items;
  } catch (error) {
    emit(projectId, {
      ...analysisJobsState(projectId),
      status: analysisJobsState(projectId).items.length > 0 ? 'ready' : 'error',
      error,
    });
    throw error;
  }
}

export function watchAnalysisJobs(projectId: ProjectId, keep = false): () => void {
  let watch = watches.get(projectId);
  if (!watch) {
    watch = { count: 0, keep: 0, timer: null };
    watches.set(projectId, watch);
  }
  watch.count += 1;
  if (keep) watch.keep += 1;
  if (watch.count === 1) {
    const current = analysisJobsState(projectId);
    if (current.status !== 'ready' || current.items.some(live)) void tick(projectId);
  }
  return () => {
    const current = watches.get(projectId);
    if (!current) return;
    current.count -= 1;
    if (keep) current.keep -= 1;
    if (current.count > 0) return;
    if (current.timer) clearTimeout(current.timer);
    watches.delete(projectId);
  };
}

async function tick(projectId: ProjectId): Promise<void> {
  const watch = watches.get(projectId);
  if (!watch) return;
  try {
    await loadAnalysisJobs(projectId);
  } catch {
    // keep the last known state; retry while there is something to watch
  }
  const current = watches.get(projectId);
  if (!current) return;
  if (current.timer) clearTimeout(current.timer);
  const active = current.keep > 0 || analysisJobsState(projectId).items.some(live);
  current.timer = active ? setTimeout(() => void tick(projectId), POLL_MS) : null;
}

export function clearAnalysisJobs(): void {
  for (const watch of watches.values()) {
    if (watch.timer) clearTimeout(watch.timer);
  }
  watches.clear();
  states.clear();
  applied.clear();
  for (const listener of listeners) listener();
}

onSignOut(clearAnalysisJobs);
