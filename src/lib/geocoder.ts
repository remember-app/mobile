import { reverseGeocodeAsync } from 'expo-location';
import { useEffect, useState } from 'react';

import { placeName } from '@/lib/place';

/**
 * The name the phone's own geocoder gives a point — the frame's «Место». The api sends coordinates
 * and nothing else, and turning them into words is the phone's job: no outside service, no key, no
 * bill. Nothing here asks the person for location access; where the platform will not geocode
 * without it (Android), the ask fails like any other and the coordinates stand.
 */

/**
 * What each point came to, kept while the app runs and nowhere else: the coordinates and the name
 * are the person's, so neither goes to disk or to the log. It holds the promise, so an ask made
 * while the first is still in the air joins it — and it holds the ones that came to nothing too,
 * because a sheet opened again is not a reason to knock on a geocoder that just said no.
 */
const named = new Map<string, Promise<string | null>>();

const keyOf = (latitude: number, longitude: number) => `${latitude},${longitude}`;

/** The name of the point, or `null` — never a rejection: no name is the ordinary answer. */
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
    // Only the error's code: its message is free text and may carry the point.
    console.warn('place name skipped:', (e as { code?: unknown } | null)?.code ?? 'failed');
    return null;
  }
}

/**
 * The name of where a frame was shot, for the sheet that shows it — `null` until the geocoder has
 * answered, and for good when it has not got one, which is when the sheet writes the coordinates.
 *
 * What is held is the answer *and the point it was for*, and a name is only handed back for the
 * point being asked about now. The sheet stays mounted from one frame to the next, so an answer
 * that comes in late for the frame before would otherwise land in the next frame's sheet.
 */
export function usePlaceName(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  const [found, setFound] = useState<{ key: string; name: string | null } | null>(null);

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
