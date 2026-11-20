import { useCallback, useState } from 'react';

import { type GalleryFiltersValue, NO_FILTERS } from './gallery-filters';

export function useGalleryFilters(initial: Partial<GalleryFiltersValue> = {}) {
  const start = { ...NO_FILTERS, ...initial };
  const [filters, setFilters] = useState<GalleryFiltersValue>(start);

  const reset = useCallback(() => setFilters({ ...NO_FILTERS, ...initial }), [initial]);

  return { filters, setFilters, reset };
}
