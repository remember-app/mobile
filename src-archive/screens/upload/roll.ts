import * as MediaLibrary from 'expo-media-library/legacy';
import { useEffect, useState } from 'react';
import { useStrings } from '@/lib/language';

const WANTED = ['photo', 'video'] as const;
const PAGE = 500;
export function useRoll(): {
  access: MediaLibrary.PermissionResponse | null;
  ask: () => Promise<MediaLibrary.PermissionResponse>;
  granted: boolean;
  limited: boolean;
  assets: MediaLibrary.Asset[];
  reading: boolean;
  error: string | null;
  again: () => void;
  chooseMore: () => Promise<void>;
} {
  const s = useStrings();
  const [access, ask] = MediaLibrary.usePermissions({ granularPermissions: [...WANTED] });
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [reading, setReading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rereads, setRereads] = useState(0);
  const granted = access?.granted ?? false;
  const limited = access?.accessPrivileges === 'limited';
  useEffect(() => {
    if (!granted) return;
    let live = true;
    setAssets([]);
    setError(null);
    setReading(true);
    void (async () => {
      try {
        let after: string | undefined;
        do {
          const page = await MediaLibrary.getAssetsAsync({
            first: PAGE,
            after,
            mediaType: [...WANTED],
            sortBy: ['creationTime'],
          });
          if (!live) return;
          setAssets((have) => have.concat(page.assets));
          after = page.hasNextPage ? page.endCursor : undefined;
        } while (after !== undefined);
      } catch {
        if (live) setError(s.upload.cannotRead);
      } finally {
        if (live) setReading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [granted, rereads]);
  return {
    access,
    ask,
    granted,
    limited,
    assets,
    reading,
    error,
    again: () => setRereads((n) => n + 1),
    chooseMore: async () => {
      await MediaLibrary.presentPermissionsPickerAsync([...WANTED]).catch(() => {});
      setRereads((n) => n + 1);
    },
  };
}
