import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/**
 * How many frames stand in a row of a gallery — three, five or seven — and the pick outlives the app
 * (doc-12).
 *
 * Held the same way as the language (`language.ts`) and the theme (`@/theme`): one value for the
 * whole app, so it is one module variable and not a context, and the four galleries that cut their
 * rows read it through the hook below.
 *
 * It is on the phone and not on the account because the phone draws the feed out of its own cache
 * before the network has answered: a density from the server would land after the first frame and
 * re-cut every row of a cold start under the person looking at it.
 */

/** How many across a gallery is cut. Three as the layout draws it; five and seven are the same grid. */
export type Density = 3 | 5 | 7;

/** The three on offer, in the order the control draws them. */
export const DENSITIES: readonly Density[] = [3, 5, 7];

/** What the galleries stand at until somebody says otherwise — the layout's own three. */
export const DENSITY_DEFAULT: Density = 3;

/**
 * Where the picked density is kept. Not a secret, but `expo-secure-store` is the key-value store
 * this app already carries, and one string is not worth a second storage library.
 */
const CHOICE_KEY = 'density';

let current: Density = DENSITY_DEFAULT;

const listeners = new Set<() => void>();

function set(next: Density): Density {
  if (next !== current) {
    current = next;
    for (const listener of listeners) listener();
  }
  return current;
}

/** What the stored string names, and the default when it names nothing this build has. */
function of(stored: string | null): Density {
  return DENSITIES.find((one) => String(one) === stored) ?? DENSITY_DEFAULT;
}

/**
 * The stored pick, read once at startup. Nothing waits for it: a gallery drawn at the default before
 * this lands is one that stands at three for a frame, and the rows are cut again the moment the
 * stored value is in — which is what the re-cut on the hook is for.
 */
export const densityReady: Promise<Density> = SecureStore.getItemAsync(CHOICE_KEY).then(
  (stored) => set(of(stored)),
  // Unreadable keychain: nothing was picked as far as this launch can tell, the layout decides.
  () => current,
);

/** How many across the galleries are cut right now, for code with no component around it. */
export function currentDensity(): Density {
  return current;
}

/**
 * Switch by hand. The grids turn first and the disk catches up: a keychain that refuses throws to
 * the caller, and the only thing lost is the memory of the pick, not the pick itself.
 */
export async function setDensity(next: Density): Promise<void> {
  set(next);
  await SecureStore.setItemAsync(CHOICE_KEY, String(next));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** How many across, for a screen that has to re-cut its rows when it changes. */
export function useDensity(): Density {
  return useSyncExternalStore(subscribe, currentDensity, currentDensity);
}