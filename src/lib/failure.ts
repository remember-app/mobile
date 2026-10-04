import { Lock, TriangleAlert, Unlink } from 'lucide-react-native';

import { ApiError, errorMessage } from '@/api';
import type { IconComponent } from '@/kit';
import type { Strings } from '@/strings';

/**
 * A failure as a banner says it: the words, and the glyph beside them. No glyph is the banner's own
 * «no signal», which only a request that never got an answer has earned.
 */
export type Failure = { text: string; icon?: IconComponent };

/** The statuses a route words itself, because the api's bare «forbidden» or «not found» says nothing. */
export type Refusals = Partial<Record<number, Failure>>;

/**
 * The api's one answer to somebody not in the memory: about the person, so a tie that is cut.
 * Several routes mean it the same way — the api says only «not found» — so it is said once here.
 */
export const notMember = (s: Strings): Refusals => ({ 404: { text: s.memory.gone, icon: Unlink } });

/** A 403 is about rights; anything else the api refused wears the plain warning. */
function glyph(status: number): IconComponent {
  return status === 403 ? Lock : TriangleAlert;
}

/**
 * The one place a refusal turns into a glyph, for every banner in the app — the same question
 * `errorMessage` answers in words, asked beside it in a sign.
 *
 * Told apart by what came back and never by the words, so a language switched under a banner cannot
 * change what it means: anything the api answered is not the connection. A 404 is something that is
 * not there, and what that is depends on the route, so every route names its own — naming the words
 * only, since the sign is the status's either way. A route that names a sign too keeps it: the
 * memory you are no longer in is about the person, and a tie is cut, whatever the status says.
 */
export function failure(e: unknown, refused: Refusals = {}): Failure {
  if (!(e instanceof ApiError)) return { text: errorMessage(e) };
  const said = refused[e.status];
  return { text: said?.text ?? e.message, icon: said?.icon ?? glyph(e.status) };
}
