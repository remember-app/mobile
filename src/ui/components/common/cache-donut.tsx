import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Circle, G, Svg, Text as SvgText } from 'react-native-svg';

import { size as formatSize } from '@/ui/format';
import { useTheme } from '@/ui/theme';

export type CacheSlice = {
  id: string;
  label: string;
  bytes: number;
  color: string;
  on?: boolean;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const amountOf = (bytes: number) => formatSize(bytes).split(' ')[0] ?? '';
const unitOf = (bytes: number) => formatSize(bytes).split(' ').slice(1).join(' ');

export function CacheDonut({
  slices,
  size = 180,
}: {
  slices: readonly CacheSlice[];
  size?: number;
}) {
  const { color } = useTheme();
  const stroke = 24;
  const centre = size / 2;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const total = slices.reduce((sum, slice) => sum + (slice.on === false ? 0 : slice.bytes), 0);
  let running = 0;
  const arcs = slices.map((slice) => {
    const bytes = slice.on === false ? 0 : slice.bytes;
    const part = total > 0 ? (bytes / total) * length : 0;
    const arc = { ...slice, part, from: running, share: total > 0 ? bytes / total : 0 };
    running += part;
    return arc;
  });

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={centre}
        cy={centre}
        r={radius}
        stroke={color.line}
        strokeWidth={stroke}
        fill="none"
      />
      <G transform={`rotate(-90 ${centre} ${centre})`}>
        {arcs.map((arc) => (
          <Arc
            key={arc.id}
            color={arc.color}
            part={arc.part}
            from={arc.from}
            length={length}
            centre={centre}
            radius={radius}
            stroke={stroke}
          />
        ))}
      </G>
      {arcs.map((arc) => {
        if (arc.share < 0.07) return null;
        const angle = ((arc.from + arc.part / 2) / length) * 2 * Math.PI - Math.PI / 2;
        return (
          <SvgText
            key={`${arc.id}-share`}
            x={centre + radius * Math.cos(angle)}
            y={centre + radius * Math.sin(angle) + 4}
            fill="#ffffff"
            fontSize={11}
            fontWeight="600"
            textAnchor="middle"
          >
            {`${Math.round(arc.share * 100)}%`}
          </SvgText>
        );
      })}
      <SvgText
        x={centre}
        y={centre - 2}
        fill={color.paper}
        fontSize={20}
        fontWeight="700"
        textAnchor="middle"
      >
        {amountOf(total)}
      </SvgText>
      <SvgText
        x={centre}
        y={centre + 17}
        fill={color.muted}
        fontSize={11}
        fontWeight="600"
        textAnchor="middle"
      >
        {unitOf(total)}
      </SvgText>
    </Svg>
  );
}

function Arc({
  color,
  part,
  from,
  length,
  centre,
  radius,
  stroke,
}: {
  color: string;
  part: number;
  from: number;
  length: number;
  centre: number;
  radius: number;
  stroke: number;
}) {
  const shown = useSharedValue(part);
  const start = useSharedValue(from);

  useEffect(() => {
    shown.value = withTiming(part, { duration: 320, easing: Easing.out(Easing.cubic) });
    start.value = withTiming(from, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [from, part, shown, start]);

  const props = useAnimatedProps(() => {
    const drawn = Math.max(shown.value - 1.5, 0);
    return {
      strokeDasharray: [drawn, Math.max(length - drawn, 0)],
      strokeDashoffset: -start.value,
    };
  });

  return (
    <AnimatedCircle
      cx={centre}
      cy={centre}
      r={radius}
      stroke={color}
      strokeWidth={stroke}
      fill="none"
      animatedProps={props}
    />
  );
}
