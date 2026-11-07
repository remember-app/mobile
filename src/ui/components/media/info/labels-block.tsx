import { Check, ChevronUp, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { LabelMark } from '@/ui/components/label';
import { Text } from '@/ui/kit/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

export type LabelChip = {
  id: string;
  name: string;
  color: string;
};

type Props = {
  labels: readonly LabelChip[];
  all: readonly LabelChip[];
  onToggle: (id: string) => void;
};

export function LabelsBlock({ labels, all, onToggle }: Props) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState(false);
  const turn = useSharedValue(0);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    turn.value = withTiming(next ? 1 : 0, { duration: 180 });
  };

  const toggleNames = () => {
    if (open) {
      setOpen(false);
      turn.value = withTiming(0, { duration: 180 });
      return;
    }
    setNames((was) => !was);
  };

  const plusStyle = useAnimatedStyle(() => ({
    opacity: 1 - turn.value,
    transform: [{ rotate: `${turn.value * 90}deg` }],
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    opacity: turn.value,
    transform: [{ rotate: `${(1 - turn.value) * -90}deg` }],
  }));

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? t('labels.hide') : t('labels.show')}
          onPress={toggleOpen}
          style={styles.side}
        >
          <Animated.View style={[styles.centre, plusStyle]}>
            <Plus size={18} color={color.muted} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.centre, chevronStyle]}>
            <ChevronUp size={18} color={color.muted} />
          </Animated.View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={names ? t('labels.hideNames') : t('labels.showNames')}
          onPress={toggleNames}
          style={styles.body}
        >
          <Animated.View layout={LinearTransition.duration(180)} style={styles.labels}>
            {labels.length === 0 ? (
              <Text role="bodySm" style={styles.muted}>
                {t('labels.noneOnPhoto')}
              </Text>
            ) : (
              labels.map((label) => (
                <Animated.View
                  key={label.id}
                  layout={LinearTransition.duration(180)}
                  style={[styles.chip, names ? styles.chipOpen : styles.chipClosed]}
                >
                  <LabelMark tint={label.color} size={30} />
                  {names ? (
                    <Text role="metaSm" numberOfLines={1} style={styles.paper}>
                      {label.name}
                    </Text>
                  ) : null}
                </Animated.View>
              ))
            )}
          </Animated.View>
        </Pressable>
      </View>
      {open ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={styles.optionsWrap}
        >
          <View style={styles.options}>
            {all.map((label) => {
              const on = labels.some((entry) => entry.id === label.id);
              return (
                <Pressable
                  key={label.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => onToggle(label.id)}
                  style={[styles.option, on ? styles.optionOn : null]}
                >
                  <LabelMark tint={label.color} size={18} />
                  <Text role="metaSm" style={on ? styles.paper : styles.muted}>
                    {label.name}
                  </Text>
                  {on ? <Check size={14} color={color.accentText} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.card,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    side: {
      width: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRightWidth: 1,
      borderRightColor: color.line,
    },
    centre: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      minHeight: 56,
      justifyContent: 'center',
      padding: space.s3,
    },
    labels: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s2,
    },
    chip: {
      borderRadius: radius.pill,
    },
    chipClosed: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipOpen: {
      height: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    optionsWrap: {
      borderTopWidth: 1.5,
      borderTopColor: color.line,
    },
    options: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.s2,
      padding: space.s3,
    },
    option: {
      height: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: space.s3,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: color.line,
    },
    optionOn: {
      borderColor: 'transparent',
      backgroundColor: color.raise,
    },
    paper: {
      color: color.paper,
    },
    muted: {
      color: color.muted,
    },
  }),
);
