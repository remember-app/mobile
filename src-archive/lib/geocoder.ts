import { geocodeAsync, reverseGeocodeAsync } from 'expo-location';
import { useEffect, useState } from 'react';
import { placeName } from '@/lib/place';

const named = new Map<string, Promise<string | null>>();
const keyOf = (latitude: number, longitude: number) => `${latitude},${longitude}`;
export function nameOfPlace(latitude: number, longitude: number): Promise<string | null> {
  const key = keyOf(latitude, longitude);
  let known = named.get(key);
  if (known === undefined) {
    known = ask(latitude, longitude);
    named.set(key, known);
  }
  return known;
}
async function ask(latitude: number, longitude: number): Promise<string | null> {
  try {
    return placeName(await reverseGeocodeAsync({ latitude, longitude }));
  } catch (e) {
    console.warn(
      'place name skipped:',
      (
        e as {
          code?: unknown;
        } | null
      )?.code ?? 'failed',
    );
    return null;
  }
}
export async function findPlace(words: string): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  try {
    const [first] = await geocodeAsync(words);
    return first ? { latitude: first.latitude, longitude: first.longitude } : null;
  } catch (e) {
    console.warn(
      'place search skipped:',
      (
        e as {
          code?: unknown;
        } | null
      )?.code ?? 'failed',
    );
    return null;
  }
}
export function usePlaceName(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  const [found, setFound] = useState<{
    key: string;
    name: string | null;
  } | null>(null);
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    let current = true;
    nameOfPlace(latitude, longitude).then((name) => {
      if (current) setFound({ key: keyOf(latitude, longitude), name });
    });
    return () => {
      current = false;
    };
  }, [latitude, longitude]);
  const key = latitude == null || longitude == null ? null : keyOf(latitude, longitude);
  return found?.key === key ? found.name : null;
}
