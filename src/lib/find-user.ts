import { useEffect, useState } from 'react';

import { ApiError, findUser, isValidUsername, type Contact } from '@/api';

/** The same wait `username-form.tsx` gives the same server: a typed word is one question. */
const LOOKUP_DELAY_MS = 400;

/**
 * Does what was typed sit anywhere in this person's name or username? The sieve under both fields
 * that narrow a saved list — the contacts screen's own, and the invite sheet's block of the same
 * people. An empty needle holds everybody, which is what makes the untouched field show the list.
 */
export const matches = (person: Contact, needle: string) =>
  needle === '' ||
  (person.username ?? '').toLowerCase().includes(needle) ||
  (person.name ?? '').toLowerCase().includes(needle);

/**
 * Somebody in Remember by the exact name standing in a field. One copy for the two fields that ask
 * it — the contacts screen's and the invite sheet's — because almost the whole of it is the
 * handling of stale replies, and that is the half that goes wrong without anybody seeing it.
 *
 * `'none'` is the api saying nobody holds the name. `null` is «nothing to say»: a question that
 * never went out, one that fell over and therefore says nothing about anybody, or one that came
 * back as `selfId` — oneself is the one person neither field has anything to offer about.
 *
 * `skip` is the caller's own answer, already drawn on their screen: a name their list or their
 * roster holds needs no question, and asking would put a second row under the one it is standing on.
 */
export function useFindUser(
  token: string | null,
  query: string,
  { skip, selfId }: { skip?: boolean; selfId?: string } = {},
): { found: Contact | 'none' | null; looking: boolean } {
  const [found, setFound] = useState<Contact | 'none' | null>(null);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    setFound(null);
    // A name that could never be held is not worth asking about — the api answers those 404 too,
    // and a question per keystroke of a half-typed name is the same answer three times over.
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
    // Drops both the question that never went out and the answer to one that did — a slow reply
    // about a name the field has since left can never overwrite a fresher one.
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [token, query, skip, selfId]);

  return { found, looking };
}
