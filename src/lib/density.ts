import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/**
 * How many frames stand in a row of a gallery — seven, five, three, or the single frame of
 * `MemorySingle` — and the pick outlives the app (doc-12).
 *
 * Held the same way as the language (`language.ts`) and the theme (`@/theme`): one value for the
 * whole app, so it is one module variable and not a context, and the galleries that cut their rows
 * read it through the hook below.
 *
 * It is on the phone and not on the account because the phone draws the feed out of its own cache
 * before the network has answered: a density from the server would land after the first frame and
 * re-cut every row of a cold start under the person looking at it.
 */

/** How many across a gallery is cut. One is not a grid but a single frame, the whole width. */
export type Density = 1 | 3 | 5 | 7;

/**
 * The scale the pinch walks, densest first (spec 10.14.1): squeezing the fingers together walks
 * toward seven across, spreading them apart walks toward three and then the last step, the single
 * frame (spec 10.14.2). The last step of one gesture, not a button of its own.
 */
export const DENSITY_SCALE: readonly Density[] = [7, 5, 3, 1];

/** What the galleries stand at until somebody says otherwise — the layout's own three. */
export const DENSITY_DEFAULT: Density = 3;

/**
 * How far the fingers have to have moved, as a doubling, for the pinch to take one step of the
 * scale: half again as far apart, or two thirds as close, is one value. The curve is the build's
 * (spec 10.14.1); the four values it walks are not.
 */
const PINCH_STEP = Math.log2(1.5);

/**
 * What the pinch has walked to, from the density it began on and how far the fingers stand apart
 * now beside where they began — `scale` 1 is untouched, above it they are spreading apart, below it
 * squeezing together. Past either end of the scale the value stands still: at seven nothing is
 * left to squeeze, and at the single frame there is no fewer.
 */
export function densityWalked(from: Density, scale: number): Density {
  if (!(scale > 0)) return from;
  const at = DENSITY_SCALE.indexOf(from);
  const steps = Math.trunc(Math.log2(scale) / PINCH_STEP);
  return DENSITY_SCALE[Math.min(DENSITY_SCALE.length - 1, Math.max(0, at + steps))];
}

/**
 * How many across a gallery that is a *grid* is cut. The memory's own feed also walks to the single
 * frame (`MemorySingle`, spec 10.14.2); the other galleries read the same pick and never cut below
 * the layout's three.
 */
export function gridColumns(density: Density): Density {
  return density === 1 ? DENSITY_DEFAULT : density;
}

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
  return DENSITY_SCALE.find((one) => String(one) === stored) ?? DENSITY_DEFAULT;
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

/**
 * Exported for `density.test.ts` as well as the hook below: there is no harness in this repo that
 * mounts a component and watches it redraw, so the contract `useSyncExternalStore` relies on — a
 * listener called when the value moves, and not when it does not — is proven by registering one
 * here directly, the way `theme.test.ts` proves its own.
 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** How many across, for a screen that has to re-cut its rows when it changes. */
export function useDensity(): Density {
  return useSyncExternalStore(subscribe, currentDensity, currentDensity);
}
