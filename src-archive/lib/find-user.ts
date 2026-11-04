import { useEffect, useState } from 'react';
import { ApiError, type Contact, findUser, isValidUsername } from '@/api';

const LOOKUP_DELAY_MS = 400;
export const matches = (person: Contact, needle: string) =>
  needle === '' ||
  (person.username ?? '').toLowerCase().includes(needle) ||
  (person.name ?? '').toLowerCase().includes(needle);
export function useFindUser(
  token: string | null,
  query: string,
  {
    skip,
    selfId,
  }: {
    skip?: boolean;
    selfId?: string;
  } = {},
): {
  found: Contact | 'none' | null;
  looking: boolean;
} {
  const [found, setFound] = useState<Contact | 'none' | null>(null);
  const [looking, setLooking] = useState(false);
  useEffect(() => {
    setFound(null);
    if (!token || skip || !isValidUsername(query)) {
      setLooking(false);
      return;
    }
    setLooking(true);
    let live = true;
    const timer = setTimeout(() => {
      findUser(token, query)
        .then(
          (person) => (live && person.id !== selfId ? setFound(person) : undefined),
          (e: unknown) =>
            live ? setFound(e instanceof ApiError && e.status === 404 ? 'none' : null) : undefined,
        )
        .finally(() => {
          if (live) setLooking(false);
        });
    }, LOOKUP_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [token, query, skip, selfId]);
  return { found, looking };
}
