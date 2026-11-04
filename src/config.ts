export const config = {
  api: {
    baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    timeoutMs: 5000,
  },
} as const;
