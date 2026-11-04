declare module '*?raw' {
  const source: string;
  export default source;
}
interface ImportMeta {
  glob<T>(
    pattern: string,
    options: {
      query: '?raw';
      import: 'default';
      eager: true;
    },
  ): Record<string, T>;
}
