/**
 * `import photo from '@/assets/images/…jpg'` — a picture that ships with the app rather than
 * arriving down the wire.
 *
 * What comes back differs by who is bundling: Metro hands over an asset id (a number) that the
 * native image loader resolves, vite hands over a url (a string). Both of them are something
 * `expo-image` takes as a `source` unchanged, which is why this is typed as the pair rather than
 * as one of them — nothing here has to know which bundler is running.
 */
declare module '*.jpg' {
  const asset: number | string;
  export default asset;
}
