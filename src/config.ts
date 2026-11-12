export const config = {
  api: {
    baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    serverOverride: process.env.EXPO_PUBLIC_API_SERVER_OVERRIDE ?? '',
    timeoutMs: 5000,
  },
} as const;
