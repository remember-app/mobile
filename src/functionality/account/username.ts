import { currentToken, onSignOut } from '@/functionality/auth/session';
import { usernameAvailable as apiUsernameAvailable } from '@/integrations/api';

const shape = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,28}[a-zA-Z0-9]$/;

const known = new Map<string, boolean>();
const asking = new Map<string, Promise<boolean>>();

export const isUsernameShapeValid = (username: string): boolean => shape.test(username);

export function knownAvailability(username: string): boolean | undefined {
  return known.get(username);
}

export async function usernameAvailable(username: string): Promise<boolean> {
  if (!isUsernameShapeValid(username)) return false;
  const saved = known.get(username);
  if (saved !== undefined) return saved;
  const running = asking.get(username);
  if (running) return running;
  const token = currentToken();
  if (!token) throw new Error('not signed in');
  const run = apiUsernameAvailable(token, username)
    .then((answer) => {
      known.set(username, answer.available);
      return answer.available;
    })
    .finally(() => {
      asking.delete(username);
    });
  asking.set(username, run);
  return run;
}

export function clearUsernameChecks(): void {
  known.clear();
  asking.clear();
}

onSignOut(clearUsernameChecks);
