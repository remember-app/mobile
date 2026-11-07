import type { ImageSource } from 'expo-image';

export type ViewerPhoto = {
  id: string;
  source: ImageSource | string | null;
  width?: number;
  height?: number;
  video?: boolean;
  assetId?: string;
  capturedAt?: Date | null;
};

export type Box = { width: number; height: number };

export type Target = Box & { left: number; top: number };
