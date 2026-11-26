import { Image as ExpoImage, type ImageProps } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';

import {
  cachedUrl,
  keepUrl,
  type MediaScope,
  onCacheCleared,
} from '@/integrations/files/media-cache';

type Props = ImageProps & { group?: string | null; scope?: MediaScope };

export function Image({ source, group, scope, onLoad, ...rest }: Props) {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => onCacheCleared(() => setEpoch((value) => value + 1)), []);

  const uri = uriOf(source);
  const local = useMemo(
    () => (uri ? cachedUrl(uri, group ?? null, scope) : null),
    [epoch, group, scope, uri],
  );

  useEffect(() => {
    if (!uri || local) return;
    let live = true;
    void keepUrl(uri, group ?? null, scope).then((saved) => {
      if (live && saved) setEpoch((value) => value + 1);
    });
    return () => {
      live = false;
    };
  }, [epoch, group, local, scope, uri]);

  return <ExpoImage {...rest} source={local ? { uri: local } : source} onLoad={onLoad} />;
}

function uriOf(source: ImageProps['source']): string | null {
  if (!source) return null;
  if (typeof source === 'string') return source;
  if (typeof source === 'number') return null;
  if (Array.isArray(source)) {
    const first = source[0];
    return typeof first === 'string' ? first : uriOf(first ?? null);
  }
  if ('uri' in source) return source.uri ?? null;
  return null;
}
