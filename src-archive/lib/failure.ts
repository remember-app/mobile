import { Lock, TriangleAlert, Unlink } from 'lucide-react-native';
import { ApiError, errorMessage } from '@/api';
import { type Failure, type IconComponent, saying } from '@/kit';
import type { Strings } from '@/strings';

export type { Failure };
export type Refusals = Partial<Record<number, Failure>>;
export const notMember = (s: Strings): Refusals => ({
  404: { text: saying(s.memory.gone), icon: Unlink },
});
function glyph(status: number): IconComponent {
  return status === 403 ? Lock : TriangleAlert;
}
export function failure(e: unknown, refused: Refusals = {}): Failure {
  if (!answered(e)) return { text: saying(errorMessage(e)) };
  const said = refused[e.status];
  return { text: said?.text ?? saying(e.message), icon: said?.icon ?? glyph(e.status) };
}
export const answered = (e: unknown): e is ApiError => e instanceof ApiError;
export const said = (text: string): Failure => ({ text: saying(text) });
export { saying };
