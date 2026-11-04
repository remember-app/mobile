import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Label, listLabels, listMedia, listMembers, type MediaItem, type Member } from '@/api';
import { answered, type Failure, failure } from '@/lib/failure';
import { keepReady, stillPreparing } from '@/lib/frames';
import { keepKept, readKept } from '@/lib/frames-kept';
import { duration } from '@/theme';

const WHILE_PREPARING_MS = 3000;
export type Link = 'ok' | 'back' | 'gone' | 'hushed';
export type Reading = 'asked' | 'under' | 'under still';
export function useMaterial({
  memoryId,
  token,
  onLabels,
  hidden = false,
}: {
  memoryId: string;
  token: string | null;
  onLabels?: (all: Label[]) => void;
  hidden?: boolean;
}): {
  items: MediaItem[] | null;
  roster: Member[] | null;
  labels: Label[];
  error: Failure | null;
  loading: boolean;
  link: Link;
  hushed: () => void;
  read: (how?: Reading) => void;
  readLabels: () => void;
  wrote: (change: (have: MediaItem[] | null) => MediaItem[] | null) => void;
} {
  const [kept] = useState(() => (hidden ? null : readKept(memoryId)));
  const drew = useRef(kept !== null);
  const [items, setItems] = useState<MediaItem[] | null>(kept?.items ?? null);
  const [roster, setRoster] = useState<Member[] | null>(kept?.roster ?? null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [error, setError] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(kept === null);
  const [link, setLink] = useState<Link>('ok');
  const writes = useRef(0);
  const read = useCallback(
    (how: Reading = 'asked') => {
      if (!token) return;
      const quiet = how !== 'asked';
      if (!quiet) {
        setError(null);
        setLoading(true);
      }
      const startedAt = writes.current;
      Promise.all([listMedia(token, memoryId, { hidden }), listMembers(token, memoryId)])
        .then(
          ([media, members]) => {
            if (how === 'under still' && writes.current !== startedAt) return;
            setItems((have) => (how === 'under still' ? keepReady(have, media) : media));
            setRoster(members);
            setError(null);
            drew.current = true;
            if (!quiet) setLink((was) => (was === 'gone' || was === 'hushed' ? 'back' : was));
            if (!hidden) keepKept(memoryId, media, members);
          },
          (e: unknown) => {
            if (quiet) return;
            setError(failure(e));
            if (!answered(e)) setLink('gone');
          },
        )
        .finally(() => {
          if (!quiet) setLoading(false);
        });
    },
    [token, memoryId, hidden],
  );
  const readLabels = useCallback(() => {
    if (!token || !onLabels) return;
    listLabels(token, memoryId).then(
      (all) => {
        setLabels(all);
        onLabels(all);
      },
      () => {},
    );
  }, [token, memoryId, onLabels]);
  useFocusEffect(
    useCallback(() => {
      read(drew.current ? 'under' : 'asked');
      readLabels();
    }, [read, readLabels]),
  );
  const preparing = stillPreparing(items);
  const focused = useIsFocused();
  useEffect(() => {
    if (!preparing || !focused) return;
    const timer = setInterval(() => read('under still'), WHILE_PREPARING_MS);
    return () => clearInterval(timer);
  }, [preparing, focused, read]);
  const wrote = useCallback((change: (have: MediaItem[] | null) => MediaItem[] | null) => {
    writes.current += 1;
    setItems(change);
  }, []);
  const hushed = useCallback(() => setLink((was) => (was === 'gone' ? 'hushed' : was)), []);
  useEffect(() => {
    if (link !== 'back') return;
    const leaves = setTimeout(() => setLink('ok'), duration.hold);
    return () => clearTimeout(leaves);
  }, [link]);
  return { items, roster, labels, error, loading, link, hushed, read, readLabels, wrote };
}
