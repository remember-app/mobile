import { ChevronDown } from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useBoardScroll } from '@/ui/kit/board-scroll';
import { useTheme } from '@/ui/theme';

type Props = {
  children: ReactNode;
  collapsed: number;
  expanded: number;
};

export function CollapsibleList({ children, collapsed, expanded }: Props) {
  const { color } = useTheme();
  const board = useBoardScroll();
  const scrollBoard = board?.scrollBy;
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);
  const offset = useSharedValue(0);
  const last = useSharedValue(0);
  const max = open ? expanded : collapsed;
  const canScroll = open && content > max;

  const toggle = () => {
    if (open) {
      scroll.current?.scrollTo({ y: 0, animated: false });
      offset.value = 0;
    }
    setOpen((was) => !was);
  };

  const native = Gesture.Native();
  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onBegin(() => {
      last.value = 0;
    })
    .onUpdate((event) => {
      const delta = event.translationY - last.value;
      last.value = event.translationY;
      if (!scrollBoard) return;
      if (!canScroll) {
        scheduleOnRN(scrollBoard, -delta);
        return;
      }
      const maxScroll = content - max;
      const atTop = offset.value <= 0.5 && delta > 0;
      const atBottom = maxScroll > 0.5 && offset.value >= maxScroll - 0.5 && delta < 0;
      if (atTop || atBottom) scheduleOnRN(scrollBoard, -delta);
    });
  const gesture = Gesture.Simultaneous(native, pan);

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <ScrollView
          ref={scroll}
          scrollEnabled={canScroll}
          bounces={false}
          style={{ maxHeight: max }}
          onContentSizeChange={(_, height) => setContent(height)}
          onScroll={(event) => {
            offset.value = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {children}
        </ScrollView>
      </GestureDetector>
      {content > collapsed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Свернуть' : 'Показать полностью'}
          onPress={toggle}
          style={[styles.arrow, { borderTopColor: color.line }]}
        >
          <ChevronDown
            size={18}
            color={color.muted}
            style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
