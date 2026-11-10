import { Circle, G, Svg, Text as SvgText } from 'react-native-svg';

import { size as formatSize } from '@/ui/format';
import { useTheme } from '@/ui/theme';

export type CacheSlice = {
  id: string;
  label: string;
  bytes: number;
  color: string;
};

type Props = {
  slices: readonly CacheSlice[];
  total: number;
  size?: number;
};

export function CacheDonut({ slices, total, size = 180 }: Props) {
  const { color } = useTheme();
  const stroke = 24;
  const centre = size / 2;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  let running = 0;
  const arcs = slices.map((slice) => {
    const share = total > 0 ? slice.bytes / total : 0;
    const part = share * length;
    const arc = { ...slice, share, part, from: running };
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
        {arcs.map((arc) => {
          const shown = Math.max(arc.part - 1.5, 0);
          return (
            <Circle
              key={arc.id}
              cx={centre}
              cy={centre}
              r={radius}
              stroke={arc.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${shown} ${length - shown}`}
              strokeDashoffset={-arc.from}
            />
          );
        })}
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
        y={centre + 6}
        fill={color.paper}
        fontSize={18}
        fontWeight="700"
        textAnchor="middle"
      >
        {formatSize(total)}
      </SvgText>
    </Svg>
  );
}
