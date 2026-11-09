import { request } from './client';
import type { SystemMediaResponseWire } from './wire';

export function systemMedia(): Promise<SystemMediaResponseWire> {
  return request<SystemMediaResponseWire>('/v1/system/media');
}
