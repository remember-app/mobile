import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { faceOf, font, themed, useTheme } from '@/ui/theme';

import { Text } from './text';

const LETTERS: Record<number, number> = {
  16: 6,
  18: 7,
  24: 9,
  26: 10,
  28: 10,
  30: 11,
  32: 11,
  36: 12,
  38: 13,
  42: 14,
  48: 15,
  64: 18,
};

const BOLD = new Set([16, 18, 24, 28, 36, 38, 48]);

type AvatarProps = {
  name: string;
  size?: number;
  uri?: string | null;
  ring?: boolean;
  gone?: boolean;
  display?: boolean;
  stacked?: {
    letters: number;
    covered: number;
  };
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ name, size = 42, uri, ring, gone, display, stacked, style }: AvatarProps) {
  const { color } = useTheme();
  const styles = useStyles();
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const letterSize = display ? Math.round(size * 0.3) : (LETTERS[size] ?? Math.round(size / 3));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        circle,
        ring ? { boxShadow: `0 0 0 1.5px ${color.spark}` } : null,
        { backgroundColor: gone ? color.surface : faceOf(name) },
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} contentFit="cover" style={[StyleSheet.absoluteFill, circle]} />
      ) : (
        <Text
          role={display ? 'subtitleDisplay' : 'row'}
          tone={gone ? 'faint' : 'onFill'}
          maxFontSizeMultiplier={1}
          style={
            stacked
              ? {
                  fontSize: stacked.letters,
                  fontFamily: font.bold,
                  paddingRight: stacked.covered,
                }
              : {
                  fontSize: letterSize,
                  lineHeight: Math.round(letterSize * 1.15),
                  ...(!display && BOLD.has(size) ? { fontFamily: font.bold } : null),
                  letterSpacing: 0,
                }
          }
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = lead(words[0]);
  const second = lead(words.length > 1 ? words[1] : words[0].slice(first.length));
  return (first + second).toUpperCase();
}

const LEAD =
  /^(?:\p{Regional_Indicator}{2}|.[\p{M}\p{Emoji_Modifier}\u{E0020}-\u{E007F}]*(?:‍.[\p{M}\p{Emoji_Modifier}\u{E0020}-\u{E007F}]*)*)/u;

function lead(word: string): string {
  return LEAD.exec(word)?.[0] ?? '';
}

const STACK = {
  36: { overlap: 12, halo: 2, letters: 11 },
  24: { overlap: 7, halo: 0, letters: 8 },
  26: { overlap: -5, halo: 0, letters: 10 },
} as const;

export function AvatarStack({
  names,
  on,
  size = 36,
  limit,
}: {
  names: readonly string[];
  on?: string;
  size?: keyof typeof STACK;
  limit?: number;
}) {
  const { color } = useTheme();
  const styles = useStackStyles();
  const under = on ?? color.surface;
  const { overlap, halo, letters } = STACK[size];
  const apart = overlap < 0;
  const collar = apart
    ? null
    : halo
      ? { boxShadow: `0 0 0 ${halo}px ${under}` }
      : { borderWidth: 1, borderColor: under };
  const over = { marginLeft: -overlap };
  const rest = limit === undefined && names.length > 4 ? names.length - 3 : 0;
  const more = limit !== undefined && names.length > limit;
  const faces =
    limit !== undefined ? names.slice(0, limit) : rest ? names.slice(0, 3) : names.slice(0, 4);
  const last = more || rest ? -1 : faces.length - 1;
  return (
    <View style={styles.row}>
      {faces.map((name, i) => (
        <Avatar
          key={`${name}-${i}`}
          name={name}
          size={size}
          stacked={{ letters, covered: i === last || apart ? 0 : overlap + halo }}
          style={[collar, i === 0 ? null : over]}
        />
      ))}
      {more ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.more, collar, over, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Plus size={Math.round(size * 0.42)} color={color.muted} />
        </View>
      ) : rest ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.more, collar, over, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Text
            role="row"
            tone={apart ? 'muted' : undefined}
            maxFontSizeMultiplier={1}
            style={[
              { fontSize: letters, fontFamily: font.bold },
              apart ? styles.moreFigures : null,
            ]}
          >
            +{rest}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    avatar: { backgroundColor: color.raise, alignItems: 'center', justifyContent: 'center' },
  }),
);

const useStackStyles = themed(({ color }) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    more: {
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreFigures: { fontVariant: ['tabular-nums'] },
  }),
);
