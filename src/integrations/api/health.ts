import { request } from './client';

export function health(): Promise<{ status: string }> {
  return request<{ status: string }>('/health', { timeout: 4000 });
}
