import type { ComponentType } from 'react';
import { useTheme } from '@/ui/theme';

export type IconComponent = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}>;

export const ICO = 22;

function strokeFor(size: number): number {
  if (size >= 24) return 1.7;
  if (size >= 20) return 1.95;
  if (size >= 16) return 2.2;
  return 2.3;
}

export function Icon({
  icon: Glyph,
  size = ICO,
  color: tint,
  fill,
  stroke,
}: {
  icon: IconComponent;
  size?: number;
  color?: string;
  fill?: string;
  stroke?: number;
}) {
  const { color } = useTheme();
  const paint = tint ?? color.paper;
  return (
    <Glyph
      size={size}
      color={paint}
      strokeWidth={stroke ?? strokeFor(size)}
      fill={fill ?? 'none'}
    />
  );
}
