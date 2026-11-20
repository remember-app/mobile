import { useCallback, useMemo, useState } from 'react';

export type GallerySelection<T> = {
  ids: ReadonlySet<T>;
  list: readonly T[];
  has: (id: T) => boolean;
  toggle: (id: T) => void;
  select: (id: T) => void;
  deselect: (id: T) => void;
  clear: () => void;
  replace: (ids: Iterable<T>) => void;
};

export function useGallerySelection<T>(): GallerySelection<T> {
  const [list, setList] = useState<T[]>([]);
  const ids = useMemo(() => new Set(list), [list]);

  const toggle = useCallback((id: T) => {
    setList((was) => (was.includes(id) ? was.filter((one) => one !== id) : [...was, id]));
  }, []);

  const select = useCallback((id: T) => {
    setList((was) => (was.includes(id) ? was : [...was, id]));
  }, []);

  const deselect = useCallback((id: T) => {
    setList((was) => was.filter((one) => one !== id));
  }, []);

  const clear = useCallback(() => setList([]), []);

  const replace = useCallback((next: Iterable<T>) => setList([...next]), []);

  return {
    ids,
    list,
    has: (id) => ids.has(id),
    toggle,
    select,
    deselect,
    clear,
    replace,
  };
}
