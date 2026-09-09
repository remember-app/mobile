import { Play } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, themed, useTheme, type Theme } from '@/theme';

import { Spinner } from './empty';
import { useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';

/** The kit's three states for a montage, section 10. */
export type MontageState = 'ready' | 'pending' | 'failed';

/**
 * The reward for everyone having sent their frames, and the only place a frame gets the full width.
 *
 * Presentation only, on purpose: the montage feature itself is frozen (doc-03), so this card takes
 * everything it draws as a prop and asks the API for nothing. `actions` is the end of the footer —
 * a download button when it is ready, a retry when it is not.
 */
export function CardMontage({
  state,
  title,
  status,
  poster,
  vertical,
  caption,
  onPlay,
  playLabel,
  actions,
  style,
}: {
  state: MontageState;
  title: string;
  /** The word for the state, in the screen's own wording — `.status`. */
  status: string;
  /** Poster frame URI, when there is one to show. */
  poster?: string;
  /**
   * A standing montage: the frame stands up with the poster — 4/5 instead of 16/9 — and the poster
   * is shown whole in it, on ink fields at the sides. Not the poster's full 9/16, which at the full
   * width of the card would take most of two screens and stop the list scrolling. The frame is the
   * ordered orientation's from the start, so a card does not jump when the still finally arrives.
   */
  vertical?: boolean;
  /** What the wait is busy with, while it is `pending`. */
  caption?: string;
  onPlay?: () => void;
  /** Spoken label for the play button; falls back to the montage's own title. */
  playLabel?: string;
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { hovered, focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const theme = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();

  return (
    <View style={[styles.card, style]}>
      {state !== 'failed' ? (
        <View style={[styles.poster, vertical ? styles.posterTall : null]}>
          {poster ? (
            <Image
              testID="card-montage-poster"
              source={{ uri: poster }}
              // Whole and not by the crop: a standing poster in a standing frame is centred by
              // `contain`, and what is left over at the sides is the frame's own ink.
              resizeMode={vertical ? 'contain' : 'cover'}
              style={styles.image}
            />
          ) : null}

          {state === 'pending' ? (
            <View style={[StyleSheet.absoluteFill, styles.pending]}>
              <Spinner />
              {caption ? <Text role="meta">{caption}</Text> : null}
            </View>
          ) : null}

          {state === 'ready' && onPlay ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playLabel ?? title}
              onPress={onPlay}
              {...props}
              style={[
                styles.play,
                hovered && !reduced ? styles.playHover : null,
                focused ? focusRing : null,
              ]}
            >
              {/* The kit draws this one glyph filled rather than stroked. */}
              <Play
                size={24}
                color={theme.shade.onEmber}
                fill={theme.shade.onEmber}
                strokeWidth={1.75}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.foot}>
        <Text role="subtitle" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.status}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(theme, state) }]} />
          <Text style={[styles.statusText, { color: statusColor(theme, state) }]}>{status}</Text>
        </View>
        {actions}
      </View>
    </View>
  );
}

function statusColor({ color, shade }: Theme, state: MontageState): string {
  if (state === 'ready') return color.fixed;
  if (state === 'failed') return shade.rustText;
  return color.muted;
}

const useStyles = themed(({ color, glow }) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: color.line,
      borderRadius: radius.card,
      overflow: 'hidden',
      backgroundColor: color.surface,
    },
    poster: { aspectRatio: 16 / 9, backgroundColor: color.ink },
    posterTall: { aspectRatio: 4 / 5 },
    image: { width: '100%', height: '100%' },
    pending: { alignItems: 'center', justifyContent: 'center', gap: space.s3 },
    play: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginTop: -28,
      marginLeft: -28,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color.ember,
      boxShadow: glow,
    },
    playHover: { transform: [{ scale: 1.05 }] },
    foot: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: space.s3,
      paddingVertical: space.s3,
      paddingHorizontal: space.s4,
    },
    title: { flex: 1, minWidth: 0 },
    status: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    statusDot: { width: 7, height: 7, borderRadius: 3.5 },
    statusText: { fontSize: 13, lineHeight: 13, fontWeight: '500' },
  }),
);
