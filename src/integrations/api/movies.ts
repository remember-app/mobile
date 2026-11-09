import type { Movie } from '@/models';
import type { Page } from '@/types/api';
import type { MovieId, ProjectId } from '@/types/id';

import { query, request } from './client';
import { toMovie, toPage } from './map';
import type { MovieWire, OffsetPageWire } from './wire';

export function listMovies(
  token: string,
  projectId: ProjectId,
  page: { limit?: number; offset?: number } = {},
): Promise<Page<Movie>> {
  return request<OffsetPageWire<MovieWire>>(`/v1/projects/${projectId}/movies${query(page)}`, {
    token,
  }).then((wire) => toPage(wire, toMovie));
}

export function renameMovie(
  token: string,
  projectId: ProjectId,
  movieId: MovieId,
  name: string,
): Promise<Movie> {
  return request<MovieWire>(`/v1/projects/${projectId}/movies/${movieId}`, {
    method: 'PATCH',
    body: { name },
    token,
  }).then(toMovie);
}

export function deleteMovie(
  token: string,
  projectId: ProjectId,
  movieId: MovieId,
): Promise<{ ok: true }> {
  return request(`/v1/projects/${projectId}/movies/${movieId}`, {
    method: 'DELETE',
    token,
  });
}
