import { FileText, Heart, House, Pencil, Zap } from 'lucide-react-native';
import type { ComponentProps, ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
export type IconComponent = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}>;
export const ICO = 22;
export const ICO_S = 18;
export const ICO_XS = 13;
export function strokeFor(size: number): number {
  if (size >= 24) return 1.5;
  if (size >= 20) return 1.75;
  if (size >= 16) return 2;
  return 2.1;
}
export const playFor = (box: number): number => Math.round((box * 13.6) / (18 + 2.1));
export function drawnAs(Glyph: IconComponent, share: number): IconComponent {
  function Drawn({ size = ICO, strokeWidth, ...paint }: ComponentProps<IconComponent>) {
    const drawn = Math.round(size * share);
    return (
      <View style={[box.centre, { width: size, height: size }]}>
        <Glyph
          size={drawn}
          strokeWidth={strokeWidth === undefined ? undefined : (strokeWidth * size) / drawn}
          {...paint}
        />
      </View>
    );
  }
  return Drawn;
}
export const DRAWN = {
  heart: drawnAs(Heart, (14 + 14) / (20 + 17)),
  zap: drawnAs(Zap, (13 + 18) / (16 + 20)),
  fileText: drawnAs(FileText, (14 + 18) / (16 + 20)),
  house: drawnAs(House, (18 + 16) / (18 + 19)),
  pen: drawnAs(Pencil, (18 + 17) / (20 + 20)),
} as const;
const box = StyleSheet.create({ centre: { alignItems: 'center', justifyContent: 'center' } });
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
