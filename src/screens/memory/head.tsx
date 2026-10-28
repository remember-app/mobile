import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import type { Memory } from '@/api';
import { Banner, Button, GlassBar, IconButton, Text } from '@/kit';
import type { Failure } from '@/lib/failure';
import { useStrings } from '@/lib/language';
import { height, space } from '@/theme';

/**
 * What the route reads once and hands down: the memory itself — its name, its days, the caller's
 * level — the failure of that read, and the way to make it again. One read for the whole screen, so
 * nothing about the memory blinks while the feed under it moves.
 */
export type Head = {
  /** null until the listing answers — the capsule stands under one shared word until it does. */
  memory: Memory | null;
  /** Words and glyph together: the read is refused as often as it is broken, and the banner says which. */
  error: Failure | null;
  reload: () => void;
};

/**
 * The glass bar over a memory's feed (spec 7.1, detail 4, and `MemoryFrames`): three pieces of glass
 * floating over the photographs — a round 48 at each side and the capsule between them. It is what
 * the memory's tabs became: there is no second screen to switch to any more, so the bar carries the
 * name, what the memory holds, and the two things that can be done from the top of it.
 *
 * What stands in the two round slots is the screen's business and not the bar's: in the feed it is
 * «Назад» and «Выбрать», in `FramesPicking` it is «Лейблы» and the same select button held in. The
 * way out of a memory is the one thing this keeps, because it is the same on every state of it — a
 * tapped push and a followed invite both open this screen with nothing behind it.
 *
 * It floats: the bar is drawn over the feed rather than above it, and its own darkening is what
 * keeps a white glyph readable when the frame underneath happens to be a white wall.
 */
export function MemoryHead({
  title,
  meta,
  capsuleLabel,
  onCapsule,
  middle,
  left,
  right,
  children,
}: {
  title: string;
  meta?: string;
  capsuleLabel: string;
  onCapsule?: () => void;
  /** What stands in the capsule's slot instead of the name — the density pill, while it is up. */
  middle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  /** What stands under the glass: the line about a memory that would not read (`HeadTrouble`). */
  children?: ReactNode;
}) {
  const router = useRouter();
  const s = useStrings();

  return (
    // `box-none` so everything around the three pieces of glass belongs to the feed underneath:
    // this layer covers the top of the screen and only the buttons on it may catch a finger.
    <View style={styles.head} pointerEvents="box-none">
      <GlassBar
        title={title}
        meta={meta}
        capsuleLabel={capsuleLabel}
        onCapsule={onCapsule}
        middle={middle}
        left={
          left ?? (
            <IconButton
              icon={ChevronLeft}
              tone="glass"
              size={height.roundViewer}
              label={s.action.back}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          )
        }
        right={right}
      />
      {children}
    </View>
  );
}

/**
 * The memory would not read: a line with the way to read it again. It stands under the glass while
 * the phone has room for it over the feed; where it has not — the smallest phone at the largest
 * system type, and the line runs taller than the screen — it scrolls at the head of the feed
 * instead, or its button would stand under the edge with nothing to bring it back (TASK-372).
 */
export function HeadTrouble({
  error,
  reload,
  onLayout,
}: Omit<Head, 'memory' | 'error'> & {
  error: Failure;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const s = useStrings();

  return (
    <View style={styles.banner} onLayout={onLayout}>
      <Banner tone="error" failure={error}>
        <Button size="xs" variant="quiet" label={s.action.retry} onPress={reload} />
      </Banner>
    </View>
  );
}

/**
 * The heading of a block on the feed (spec 8): the name in `section` and, beside it, the count of
 * what stands under it — «Ролики 2», «Кадры · 486 кадров». Two words in a row rather than a part of
 * the library: what it is made of is the kit's type roles, and the only thing it adds is that the
 * count sits on the same baseline as the name.
 */
export function BlockHead({
  title,
  count,
  style,
}: {
  title: string;
  /** Nothing yet read is nothing to count — the heading stands alone until the list answers. */
  count?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.block, style]}>
      <Text role="section" accessibilityRole="header">
        {title}
      </Text>
      {count ? <Text role="meta">{count}</Text> : null}
    </View>
  );
}

// Nothing here has a colour of its own: the glass, the words and the banner are kit components
// drawing themselves in whatever theme the app is in, and what is left is where they stand.
const styles = StyleSheet.create({
  head: { position: 'absolute', left: 0, right: 0, top: 0 },
  // The glass bar keeps 12 at the sides (spec 7.1), and the line about a failed read lines up with it.
  banner: { marginHorizontal: space.s3, marginTop: space.s2 },
  block: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s2,
    paddingHorizontal: space.s4,
  },
});
