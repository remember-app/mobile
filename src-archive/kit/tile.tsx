import { Image } from 'expo-image';
import { Check, EyeOff, ImageIcon, Play, X } from 'lucide-react-native';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import {
  font,
  duration as motion,
  night,
  photo,
  radius,
  space,
  spinner,
  themed,
  useTheme,
} from '@/theme';
import { Spinner } from './empty';
import { Icon, type IconComponent } from './icon';
import { useFocusRing, useHoverFocus, useReducedMotion } from './interaction';
import { Text } from './text';
export type TileState = 'ready' | 'processing' | 'failed';
export type PickKind = 'send' | 'keep' | 'off' | 'auto' | 'hand';
export type TileLane = 'feed' | 'pick';
export type OwnState = 'flying' | 'stuck' | 'hidden';
export const GRID_GAP = 3;
export const FEED_GAP = 2;
export function Tile({
  state,
  uri,
  cacheKey,
  lane = 'pick',
  pick,
  ring,
  length,
  single,
  ratio,
  reason,
  caption,
  own,
  percent,
  label,
  onPress,
  style,
}: {
  state: TileState;
  uri?: string;
  cacheKey?: string;
  own?: OwnState;
  percent?: string;
  lane?: TileLane;
  pick?: PickKind;
  ring?: boolean;
  length?: string;
  single?: boolean;
  ratio?: number | null;
  reason?: {
    icon: IconComponent;
    label: string;
  };
  caption?: string;
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const { color } = useTheme();
  const styles = useStyles();
  const focusRing = useFocusRing();
  const dropped = pick === 'auto' || pick === 'hand';
  const picked = pick === 'send' || pick === 'keep';
  const inner = (
    <>
      {state === 'ready' && uri ? (
        <Image
          source={cacheKey ? { uri, cacheKey } : { uri }}
          contentFit="cover"
          transition={reduced ? 0 : motion.sheet}
          style={[styles.image, dropped ? styles.down : null]}
        />
      ) : null}

      {state === 'processing' ? (
        <View style={[StyleSheet.absoluteFill, styles.state]}>
          <Spinner size={16} />
          {caption ? (
            <Text role="meta" fit style={styles.caption}>
              {caption}
            </Text>
          ) : null}
        </View>
      ) : null}

      {state === 'failed' ? (
        <View style={[StyleSheet.absoluteFill, styles.state]}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon icon={ImageIcon} size={22} color={color.faint} />
          </View>

          {caption ? (
            <Text role="meta" fit style={styles.caption}>
              {caption}
            </Text>
          ) : null}
        </View>
      ) : null}

      {own ? <OwnLayer own={own} percent={percent} /> : null}

      {length && state === 'ready' && !reason ? (
        <FrameMark length={length} lane={lane} single={single} />
      ) : null}
      {reason ? <FrameMark icon={reason.icon} label={reason.label} lane={lane} /> : null}

      {picked ? (
        <View
          testID="tile-scrim"
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, ring ? styles.scrimRing : styles.scrim]}
        />
      ) : null}

      {ring && picked ? (
        <View
          testID="tile-ring"
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.ring, { borderColor: color.accent }]}
        />
      ) : null}

      {pick && pick !== 'auto' && !(ring && pick === 'off') ? (
        <PickCircle kind={pick} size={lane === 'feed' ? 24 : 22} />
      ) : null}
    </>
  );
  const frame: StyleProp<ViewStyle> = [
    styles.tile,
    lane === 'feed' ? styles.feed : null,
    ratio ? { aspectRatio: ratio } : null,
    state === 'processing' ? styles.processing : null,
    state === 'failed' ? styles.broken : null,
    style,
  ];
  if (!onPress) {
    return (
      <View style={frame} accessibilityRole="image" accessibilityLabel={label}>
        {inner}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole={pick ? 'checkbox' : 'button'}
      accessibilityLabel={label}
      accessibilityState={pick ? { checked: picked } : undefined}
      onPress={onPress}
      {...props}
      style={[frame, focused ? focusRing : null]}
    >
      {inner}
    </Pressable>
  );
}
export function PickCircle({
  kind,
  size = 22,
}: {
  kind: Exclude<PickKind, 'auto'>;
  size?: 24 | 22 | 13;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const tiny = size === 13;
  const tick = tiny ? 8 : 13;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.pick,
        { width: size, height: size },
        tiny ? null : size === 24 ? styles.pickCornerFeed : styles.pickCorner,
        kind === 'send' ? [styles.pickSend, { backgroundColor: color.accent }] : null,
        kind === 'send' && tiny ? styles.pickBare : null,
        kind === 'keep' ? { backgroundColor: color.spark } : null,
        kind === 'off'
          ? tiny
            ? { borderWidth: 1, borderColor: color.faint }
            : styles.pickOff
          : null,
        kind === 'hand' ? [styles.pickHand, { borderColor: night.lineStrong }] : null,
      ]}
    >
      {kind === 'send' ? <Icon icon={Check} size={tick} color={color.onFill} /> : null}
      {kind === 'keep' ? <Icon icon={Check} size={tick} color={color.sparkInk} /> : null}
      {kind === 'hand' ? <Icon icon={X} size={tick} color={night.muted} /> : null}
    </View>
  );
}
const OWN_SCRIM: Record<OwnState, string> = {
  flying: photo.flying,
  stuck: photo.stuck,
  hidden: photo.hidden,
};
function OwnLayer({ own, percent }: { own: OwnState; percent?: string }) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View
      testID="tile-own"
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: OWN_SCRIM[own] },
        own === 'stuck' ? { borderWidth: 2, borderColor: color.dangerFill } : null,
      ]}
    >
      {own === 'flying' ? (
        <>
          <View style={styles.ownMiddle}>
            <Spinner size={spinner.card} ring={2.5} track={photo.flyingTrack} />
          </View>
          {percent ? (
            <View style={styles.percent}>
              <Text role="percent" style={styles.onPlate}>
                {percent}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <View
          style={[
            styles.ownSign,
            { backgroundColor: own === 'stuck' ? color.dangerFill : photo.ownPlate },
          ]}
        >
          {own === 'stuck' ? (
            <Text role="percent" style={[styles.onPlate, styles.bang]}>
              !
            </Text>
          ) : (
            <Icon icon={EyeOff} size={13} stroke={2} color={night.paper} />
          )}
        </View>
      )}
    </View>
  );
}
const FEED_PLAY = 6;
export function FrameMark({
  length,
  icon,
  label,
  lane = 'pick',
  single = false,
}: {
  length?: string;
  icon?: IconComponent;
  label?: string;
  lane?: TileLane;
  single?: boolean;
}) {
  const styles = useStyles();
  const bare = lane === 'feed' && !label;
  return (
    <View
      style={[
        styles.mark,
        bare ? styles.markBare : null,
        single ? styles.markSingle : null,
        label ? styles.markWide : null,
      ]}
    >
      <Icon
        icon={icon ?? Play}
        size={bare ? FEED_PLAY : length ? 9 : 11}
        stroke={label ? 2 : undefined}
        color={photo.on}
        fill={length ? photo.on : undefined}
      />
      <Text
        role="meta"
        numberOfLines={1}
        style={[
          styles.markText,
          bare ? styles.markShadow : null,
          single ? styles.markTextSingle : null,
          label ? styles.markTextSm : null,
        ]}
      >
        {length ?? label}
      </Text>
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    tile: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: radius.tile,
      overflow: 'hidden',
      backgroundColor: color.surface,
    },
    feed: { borderRadius: 0 },
    processing: { borderWidth: 1, borderColor: color.line },
    broken: { backgroundColor: color.raise },
    image: { width: '100%', height: '100%' },
    down: { opacity: 0.32 },
    state: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.s2 },
    caption: { textAlign: 'center' },
    scrim: { backgroundColor: photo.picked },
    scrimRing: { backgroundColor: photo.pickedRing },
    ring: { borderWidth: 3, borderRadius: radius.tile },
    pick: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    pickCorner: { position: 'absolute', top: 6, right: 6 },
    pickCornerFeed: { position: 'absolute', top: 7, right: 7 },
    pickSend: { borderWidth: 2, borderColor: photo.on },
    pickBare: { borderWidth: 0 },
    pickOff: { backgroundColor: photo.pickOff, borderWidth: 2, borderColor: photo.pickEdge },
    pickHand: { backgroundColor: photo.pickHand, borderWidth: 1 },
    mark: {
      position: 'absolute',
      left: 6,
      bottom: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: radius.pill,
      backgroundColor: photo.mark,
    },
    markBare: {
      left: undefined,
      right: 7,
      bottom: 6,
      gap: 4,
      paddingHorizontal: 0,
      paddingVertical: 0,
      backgroundColor: undefined,
    },
    markSingle: { right: 12, bottom: 12 },
    markTextSingle: { fontSize: 13, lineHeight: 17 },
    markWide: {
      left: 5,
      right: 5,
      bottom: 5,
      paddingHorizontal: space.s2,
      backgroundColor: photo.markStrong,
    },
    markText: { color: photo.on, fontSize: 11, lineHeight: 14, fontFamily: font.semi },
    markShadow: {
      textShadowColor: 'rgba(0,0,0,0.7)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    markTextSm: { color: night.muted, fontSize: 10, lineHeight: 15, flexShrink: 1 },
    ownMiddle: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    percent: {
      position: 'absolute',
      left: 6,
      bottom: 6,
      paddingVertical: 2,
      paddingHorizontal: 7,
      borderRadius: radius.pill,
      backgroundColor: photo.ownPlate,
    },
    ownSign: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    onPlate: { color: night.paper },
    bang: { color: photo.on, fontSize: 13, lineHeight: 16 },
  }),
);
