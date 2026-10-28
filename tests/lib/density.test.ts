import { expect, test, vi } from 'vitest';

// `expo-secure-store` is native and does not exist under vitest, so this stands in for the phone's
// keychain. It is keyed, because the key is half of «выбор помнится» (doc-12): a pick written under
// one name and read under another is a pick that does not survive the launch, and a stand-in that
// kept one value whatever it was asked for would call that a launch that worked.
const { phone } = vi.hoisted(() => ({ phone: { disk: new Map<string, string>() } }));

vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => phone.disk.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    phone.disk.set(key, value);
  },
}));

/** A cold start of the app, carrying whatever the last start left on the phone. */
async function start() {
  vi.resetModules();
  const density = await import('@/lib/density');
  await density.densityReady;
  return density;
}

/** The pick as it stands on the disk, under whatever name the app filed it. */
const stored = () => [...phone.disk.entries()];

test('three across until somebody says otherwise — the layout’s own three', async () => {
  phone.disk.clear();
  const density = await start();
  expect(density.currentDensity()).toBe(3);
  expect(density.DENSITY_DEFAULT).toBe(3);
  // The scale the pinch walks, densest first (spec 10.14.1): seven, five, three, and the single
  // frame at the far end — the last step of the same gesture, not a value of its own.
  expect(density.DENSITY_SCALE).toEqual([7, 5, 3, 1]);
});

test('the pinch walks the scale, one step to half again as far apart or two thirds as close', async () => {
  const { densityWalked } = await start();
  // Untouched, and inside the first step either way: the value it began on.
  for (const scale of [1, 1.2, 0.9]) expect(densityWalked(3, scale), String(scale)).toBe(3);
  // Spreading the fingers cuts fewer to a row; squeezing cuts more. Half again as far apart, or
  // two thirds as close, is one step, and the scale is walked step by step from where it began.
  expect(densityWalked(3, 1.5)).toBe(1);
  expect(densityWalked(3, 1.7)).toBe(1);
  expect(densityWalked(7, 2.5)).toBe(3);
  expect(densityWalked(3, 0.6)).toBe(5);
  expect(densityWalked(3, 0.4)).toBe(7);
  expect(densityWalked(5, 0.4)).toBe(7);
  // Past either end the value stands still: seven is as many as fits, and the single frame is the
  // last step — there is no fewer than one.
  expect(densityWalked(7, 0.1)).toBe(7);
  expect(densityWalked(1, 5)).toBe(1);
  // A finger that came back to where it began asks for nothing.
  expect(densityWalked(3, 1)).toBe(3);
});

test('a picked density beats the default, and outlives the app', async () => {
  phone.disk.clear();
  const first = await start();
  await first.setDensity(5);
  expect(first.currentDensity()).toBe(5);
  // The same phone, next launch: the pick is read back off the disk rather than the default
  // answering again — the one thing the setting is for.
  expect((await start()).currentDensity()).toBe(5);
});

test('the pick is filed under one key and read back under that same one', async () => {
  // A stand-in that kept one value whatever it was asked for would pass the test above with the key
  // spelled two different ways in the two places: written under one, read under another, and every
  // launch quietly back at three. The key is named here, so a rename is a red run — and it is
  // `density`, beside the app's own `language` and `theme` and apart from both.
  phone.disk.clear();
  const first = await start();
  await first.setDensity(7);
  expect(stored()).toEqual([['density', '7']]);
  // One string, and nobody else's key: a pick that landed under the language's would be read by two
  // settings at once.
  expect(phone.disk.size).toBe(1);
  // And it is still there for the launch that only ever reads.
  expect((await start()).currentDensity()).toBe(7);
});

test('a stored value this build does not know is not a pick', async () => {
  // Four, six, a blank, anything a rolled-back build or a hand-edited keychain could leave behind:
  // the layout’s three stand until a person walks the scale to one of its own values.
  for (const value of ['4', '6', '', 'five']) {
    phone.disk.clear();
    phone.disk.set('density', value);
    expect((await start()).currentDensity(), value).toBe(3);
  }
  // The single frame is one of them now (spec 10.14.2), and it is read back like the rest.
  phone.disk.clear();
  phone.disk.set('density', '1');
  expect((await start()).currentDensity()).toBe(1);
});

test('a keychain that cannot be read leaves the layout deciding, and does not throw at a launch', async () => {
  const density = await start();
  // `densityReady` refuses nothing at the app's face: the promise resolves to what it decided to
  // stand at, so a broken keychain costs the memory of the pick and not the launch.
  expect(await density.densityReady).toBe(density.currentDensity());
});

test('the grids redraw when the pick changes, which is how a screen re-cuts its rows', async () => {
  // There is no harness in this repo that mounts a component and watches it redraw, so the contract
  // `useSyncExternalStore` relies on is proven here the way `theme.test.ts` proves its own: a
  // listener registered directly is called when the value moves, and not when it does not.
  phone.disk.clear();
  const density = await start();
  let told = 0;
  const off = density.subscribe(() => {
    told += 1;
  });
  await density.setDensity(7);
  expect(density.currentDensity()).toBe(7);
  expect(told).toBe(1);
  // And a pick that does not move the value does not redraw the world either.
  await density.setDensity(7);
  expect(told).toBe(1);
  off();
  await density.setDensity(3);
  expect(told).toBe(1);
});
