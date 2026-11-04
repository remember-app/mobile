import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
export type Density = 1 | 3 | 5 | 7;
export const DENSITY_SCALE: readonly Density[] = [7, 5, 3, 1];
export const DENSITY_DEFAULT: Density = 3;
const PINCH_STEP = Math.log2(1.5);
export function densityWalked(from: Density, scale: number): Density {
  if (!(scale > 0)) return from;
  const at = DENSITY_SCALE.indexOf(from);
  const steps = Math.trunc(Math.log2(scale) / PINCH_STEP);
  return DENSITY_SCALE[Math.min(DENSITY_SCALE.length - 1, Math.max(0, at + steps))];
}
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
function of(stored: string | null): Density {
  return DENSITY_SCALE.find((one) => String(one) === stored) ?? DENSITY_DEFAULT;
}
export const densityReady: Promise<Density> = SecureStore.getItemAsync(CHOICE_KEY).then(
  (stored) => set(of(stored)),
  () => current,
);
export function currentDensity(): Density {
  return current;
}
export async function setDensity(next: Density): Promise<void> {
  set(next);
  await SecureStore.setItemAsync(CHOICE_KEY, String(next));
}
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useDensity(): Density {
  return useSyncExternalStore(subscribe, currentDensity, currentDensity);
}
