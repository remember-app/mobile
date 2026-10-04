import { createElement } from 'react';
import { View } from 'react-native';
import { vi } from 'vitest';

/**
 * The native modules the library reaches for, stood in for once instead of at the top of twenty
 * test files. Every one of these is a native module: node cannot parse any of them, so a component
 * that touches one will not even import without this.
 *
 * None of them is what a test here is about. These tests render a component to a string through
 * `react-native-web` and read the markup: what shape a part came out, what colour it is drawn in,
 * which state it is showing. What the phone's own Image does with a `ph://` reference, and what a
 * Lucide glyph looks like as SVG, are outside anything node can see and belong to the pilot.
 */

/**
 * The one door out to the network, shut for the whole run. A test that wants the api asks `serve()`
 * for a stand-in (`tests/helpers/api.ts`); a `fetch` that arrives without one belongs to a tree or
 * a timer a finished test left standing, and it has no business reaching a real server — it would
 * be answered by whatever runs on that address, at whatever moment it happens to be asked. Here it
 * is refused the way an unreachable api is refused, so the code under test takes the same road it
 * takes on a phone with no connection, and the test that asked decides what that road means.
 */
globalThis.fetch = () => Promise.reject(new TypeError('Network request failed'));

// The theme reads the stored pick at import; the keychain only has to answer.
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

// The phone's geocoder, which names a point. Here it names nothing, and a sheet that asks stays on
// the coordinates; the test that is about the geocoder itself mocks it again with answers of its own.
vi.mock('expo-location', () => ({ reverseGeocodeAsync: async () => [] }));

// Over-the-air updates, which are off everywhere but a store build: nothing is ever pending here.
vi.mock('expo-updates', () => ({ useUpdates: () => ({ isUpdatePending: false }) }));

// The phone's own share sheet. Here it opens and is closed at once; the test that is about what
// goes into it mocks it again and watches the call.
vi.mock('expo-sharing', () => ({ shareAsync: async () => {} }));

// Photos and posters. `expo-image` and not React Native's own — `kit/tile.tsx` says why. It stands
// in as a plain view wearing the same style, so what a part does *to* a picture — dimming a dropped
// frame, rounding a thumbnail — is still there to be read off the markup.
//
// `source` comes through as well, and that is the point: it is the url a picture is fetched from and
// the key it is filed under (`kit/tile.tsx`), and dropping it here made every question about either
// one invisible. A test that removed the cache key from a tile went green, because the stub had
// thrown the key away before anybody could look at it. Carried here rather than re-mocked in each
// test that asks: the mock is in one place, so a test written later cannot inherit the blindness by
// forgetting to stand over it. `tests/setup/image-stub.test.tsx` pins this.
vi.mock('expo-image', () => ({
  Image: ({ style, ...rest }: { style?: unknown; [prop: string]: unknown }) =>
    createElement(View, { style, ...rest, testID: 'image' } as never),
}));

type Glyph = (props: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) => unknown;

/**
 * A glyph, drawn as the bare `<svg>` a real Lucide icon comes out as — carrying the four things
 * `kit/icon.tsx` sets on it and its own name, nothing else. It has to draw *something*: a stub
 * returning `null` makes a button with a glyph and a button without one render identically, and a
 * story that cannot tell those apart is not watching the thing it was written for. And one per name,
 * the same one every time it is asked for: a banner that says «вас здесь нет» under the «no signal»
 * glyph has to be told apart from one that does not.
 */
const glyphs = new Map<string, Glyph>();
const glyph = (name: string): Glyph => {
  const known = glyphs.get(name);
  if (known) return known;
  const drawn: Glyph = ({ size, color, strokeWidth, fill }) =>
    createElement('svg', {
      'data-glyph': name,
      width: size,
      height: size,
      stroke: color,
      strokeWidth,
      fill,
    });
  glyphs.set(name, drawn);
  return drawn;
};

// Every glyph in the set, without naming them one by one: a test that had to list the icons a
// component happens to import would break every time one of them changed. Only the capitalised
// names answer — `default`, `__esModule` and the symbols vitest itself looks for have to come back
// undefined, or the module reads as something other than a bag of components.
vi.mock(
  'lucide-react-native',
  () =>
    new Proxy(
      {},
      {
        get: (target, key) =>
          typeof key === 'string' && /^[A-Z]/.test(key) ? glyph(key) : Reflect.get(target, key),
        // Vitest checks a mocked module actually carries the name a file imports before it hands
        // it over, so the bag has to admit to holding them as well as answering for them.
        has: (target, key) =>
          (typeof key === 'string' && /^[A-Z]/.test(key)) || Reflect.has(target, key),
      },
    ),
);

// The phone's own disk. A working one and not a stub that only refuses: what is kept on the phone
// between two launches is a real subject here (TASK-512 — the feed a memory opens on with no
// network), and a disk that answers to nothing would make every such claim true on paper and blind
// in fact. A map keyed by path, so a write is read back by the next line that opens the same file —
// which is what a real disk does and what the app's own cache relies on.
vi.mock('expo-file-system', () => {
  const disk = new Map<string, string>();
  const folders = new Set<string>();
  /**
   * The path a `File` or a `Directory` names, as the real library builds it: each part after the
   * first is appended to the one before it, and a `Directory` handed in as a part carries its own
   * path rather than being turned into a string. `new File(dir, name)` is how every caller in this
   * repo writes, so a stand-in that read the directory as `[object Object]` would put every write
   * under a folder nothing could delete.
   */
  const at = (parts: unknown[]) =>
    parts
      .map((one) => {
        if (typeof one !== 'object' || one === null) return String(one);
        const uri = (one as { uri?: unknown }).uri;
        return typeof uri === 'string' ? uri : String(one);
      })
      .join('/');
  class Directory {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = at(parts);
    }
    get exists() {
      return folders.has(this.uri);
    }
    create() {
      folders.add(this.uri);
    }
    delete() {
      // A real directory delete takes what is under it, and the app's `forgetKept` relies on that:
      // a stand-in that dropped the folder and left the files would say a session had forgotten
      // everything while every photograph stayed exactly where it was.
      for (const key of [...disk.keys()]) if (key.startsWith(`${this.uri}/`)) disk.delete(key);
      folders.delete(this.uri);
    }
  }
  class File {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = at(parts);
    }
    get exists() {
      return disk.has(this.uri);
    }
    create() {
      disk.set(this.uri, '');
    }
    textSync() {
      const held = disk.get(this.uri);
      if (held === undefined) throw new Error(`File '${this.uri}' could not be read.`);
      return held;
    }
    write(content: string) {
      disk.set(this.uri, content);
    }
    delete() {
      disk.delete(this.uri);
    }
  }
  return { Directory, File, Paths: { document: 'documents', cache: 'cache' } };
});

// The sheet shuts itself when the screen under it loses focus; nothing here mounts a router.
vi.mock('expo-router', () => ({ useFocusEffect: () => {} }));

/**
 * `Modal` puts its children through a portal, and a portal needs a document — so a sheet rendered
 * to a string comes out empty and every story about one would be a story about nothing. Here it is
 * the plain container it is on a phone: what is inside when it is up, nothing when it is not.
 */
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  return {
    ...rn,
    Modal: ({ visible, children }: { visible?: boolean; children?: unknown }) =>
      visible === false ? null : (children as never),
  };
});

// The bar and the bottom layer both pad themselves off the phone's own insets.
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
