import { Lock, TriangleAlert } from 'lucide-react-native';

import { ApiError, errorMessage } from '@/api';
import type { IconComponent } from '@/kit';

/**
 * A failure as a banner says it: the words, and the glyph beside them. No glyph is the banner's own
 * «no signal», which only a request that never got an answer has earned.
 */
export type Failure = { text: string; icon?: IconComponent };

/** The statuses a route words itself, because the api's bare «forbidden» or «not found» says nothing. */
export type Refusals = Partial<Record<number, Failure>>;

/**
 * The one place a refusal turns into a glyph, for every banner in the app — the same question
 * `errorMessage` answers in words, asked beside it in a sign.
 *
 * Told apart by what came back and never by the words: anything the api answered is not the
 * connection, and the two are told apart by the status alone so a language switched under a banner
 * cannot change its meaning. A 403 is about rights; a 404 is something that is not there, and what
 * that is depends on the route, so every route names its own; anything else the api refused — a
 * conflict, a rate limit, a route it has not built — is said in its words beside a plain warning,
 * because the design gives that refusal no sign of its own and a sign invented here would be one
 * nobody drew (spec 5).
 */
export function failure(e: unknown, refused: Refusals = {}): Failure {
  if (!(e instanceof ApiError)) return { text: errorMessage(e) };
  return refused[e.status] ?? { text: e.message, icon: e.status === 403 ? Lock : TriangleAlert };
}
