/**
 * `import source from './x.tsx?raw'` — a file's own text, handed over by the bundler untouched.
 * Vite (and so vitest) answers this suffix already; this only tells TypeScript what comes back.
 * Nothing the app ships uses it: `node:fs` is unreachable from `src/` on purpose — everything here
 * runs on a phone — and this is how a test reads a screen it cannot render.
 */
declare module '*?raw' {
  const source: string;
  export default source;
}
