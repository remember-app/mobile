import { Image as ExpoImage, type ImageProps } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';

import { cachedUrl, keepLoaded, onCacheCleared } from '@/integrations/files/media-cache';

type Props = ImageProps & { group?: string | null };

export function Image({ source, group, onLoad, ...rest }: Props) {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => onCacheCleared(() => setEpoch((value) => value + 1)), []);

  const uri = uriOf(source);
  const local = useMemo(() => (uri ? cachedUrl(uri, group ?? null) : null), [epoch, group, uri]);

  return (
    <ExpoImage
      {...rest}
      source={local ? { uri: local } : source}
      onLoad={(event) => {
        onLoad?.(event);
        if (uri && !local) void keepLoaded(uri, group ?? null);
      }}
    />
  );
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
