import { useEffect, useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { displayName } from '@/models';
import { faceOf, font, themed, useTheme } from '@/ui/theme';

import { Image } from './image';
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
  name: string | null | undefined;
  username?: string | null;
  size?: number;
  uri?: string | null;
  ring?: boolean;
  gone?: boolean;
  display?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({
  name,
  username,
  size = 42,
  uri,
  ring,
  gone,
  display,
  style,
}: AvatarProps) {
  const { color } = useTheme();
  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [uri]);
  const face = displayName(name, username);
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
        { backgroundColor: gone ? color.surface : faceOf(face) },
        style,
      ]}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          scope="avatars"
          contentFit="cover"
          style={[StyleSheet.absoluteFill, circle]}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          role={display ? 'subtitleDisplay' : 'row'}
          tone={gone ? 'faint' : 'onFill'}
          maxFontSizeMultiplier={1}
          style={{
            fontSize: letterSize,
            lineHeight: Math.round(letterSize * 1.15),
            ...(!display && BOLD.has(size) ? { fontFamily: font.bold } : null),
            letterSpacing: 0,
          }}
        >
          {initials(face)}
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
  28: { overlap: 6, halo: 0, letters: 10 },
  24: { overlap: 5, halo: 0, letters: 8 },
  26: { overlap: -5, halo: 0, letters: 10 },
} as const;

export type AvatarFace = {
  name: string | null | undefined;
  username?: string | null;
  uri?: string | null;
};

export function AvatarStack({
  faces,
  total,
  on,
  size = 28,
  limit = 7,
}: {
  faces: readonly AvatarFace[];
  total: number;
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
  const shown = faces.slice(0, limit);
  const rest = shown.length === limit ? Math.max(0, total - shown.length) : 0;
  return (
    <View style={styles.row}>
      {shown.map((face, i) => (
        <Avatar
          key={`${face.name}-${i}`}
          name={face.name}
          username={face.username}
          uri={face.uri}
          size={size}
          style={[collar, i === 0 ? null : over]}
        />
      ))}
      {rest > 0 ? (
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
