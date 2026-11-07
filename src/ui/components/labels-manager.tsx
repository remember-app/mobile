import { useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ArrowField } from '@/ui/components/arrow-field';
import { CollapsibleList } from '@/ui/components/collapsible-list';
import { LabelMark } from '@/ui/components/label';
import { SwipeRow } from '@/ui/components/swipe-row';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Text } from '@/ui/kit/text';
import {
  createLabel,
  deleteLabel,
  type LabelWithCount,
  labelUsage,
  subscribeLabels,
} from '@/ui/mocks/labels';
import { radius, space, themed } from '@/ui/theme';

const SPECTRUM = Array.from({ length: 60 }, (_, index) => `hsl(${(index / 59) * 360}, 100%, 50%)`);
const THUMB = 28;

function hslToHex(hue: number, saturation = 1, lightness = 0.5): string {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hp = (((hue % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lightness - c / 2;
  const pair = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${pair(r)}${pair(g)}${pair(b)}`;
}

export function LabelsManager({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const labels = useSyncExternalStore(subscribeLabels, labelUsage);
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [hue, setHue] = useState(205);

  const create = () => {
    if (!name.trim()) return;
    createLabel(name, hslToHex(hue));
    setName('');
    setOpen(false);
  };

  return (
    <>
      <View style={styles.card}>
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.add}>
          <Text role="row" tone="accent">
            {t('labels.add')}
          </Text>
        </Pressable>
        <View style={styles.divider} />
        {labels.length === 0 ? (
          <Text role="noteSm" tone="muted" style={styles.empty}>
            {t('labels.none')}
          </Text>
        ) : (
          <CollapsibleList collapsed={224} expanded={392}>
            {labels.map((label, index) => (
              <View key={label.id}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <LabelRow
                  label={label}
                  onOpen={() =>
                    router.navigate({
                      pathname: '/project/[id]/label/[labelId]',
                      params: { id: projectId, labelId: label.id },
                    })
                  }
                  onDelete={() => deleteLabel(label.id)}
                />
              </View>
            ))}
          </CollapsibleList>
        )}
      </View>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('labels.new')}>
        <View style={styles.form}>
          <ColorSlider hue={hue} onChange={setHue} />
          <ArrowField
            label={t('labels.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('labels.namePlaceholder')}
            valid={name.trim().length > 0}
            onSubmit={create}
          />
        </View>
      </BottomSheet>
    </>
  );
}

function LabelRow({
  label,
  onOpen,
  onDelete,
}: {
  label: LabelWithCount;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const styles = useStyles();

  return (
    <SwipeRow tone="danger" icon={Trash2} onAction={onDelete}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.row}>
        <LabelMark tint={label.color} size={30} />
        <Text role="row" numberOfLines={1} style={styles.name}>
          {label.name}
        </Text>
        <Text role="bodySm" tone="muted">
          {label.count}
        </Text>
      </Pressable>
    </SwipeRow>
  );
}

function ColorSlider({ hue, onChange }: { hue: number; onChange: (hue: number) => void }) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const pos = useSharedValue(0);

  useEffect(() => {
    if (width > 0) pos.value = (hue / 360) * width;
  }, [width, hue, pos]);

  const pick = (x: number) => {
    'worklet';
    const next = Math.min(Math.max(x, 0), width);
    pos.value = next;
    scheduleOnRN(onChange, (next / Math.max(1, width)) * 360);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => pick(event.x))
    .onUpdate((event) => pick(event.x));

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value - THUMB / 2 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.slider} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View style={styles.spectrum}>
          {SPECTRUM.map((color) => (
            <View key={color} style={[styles.segment, { backgroundColor: color }]} />
          ))}
        </View>
        <Animated.View style={[styles.thumb, { backgroundColor: hslToHex(hue) }, thumb]} />
      </View>
    </GestureDetector>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      backgroundColor: color.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      overflow: 'hidden',
    },
    row: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
      backgroundColor: color.surface,
    },
    name: {
      flex: 1,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: color.line,
    },
    empty: {
      padding: space.s4,
    },
    add: {
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    form: {
      gap: space.s3,
    },
    slider: {
      height: 44,
      justifyContent: 'center',
    },
    spectrum: {
      height: 10,
      flexDirection: 'row',
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    segment: {
      flex: 1,
    },
    thumb: {
      position: 'absolute',
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      borderWidth: 3,
      borderColor: '#FFFFFF',
      top: (44 - THUMB) / 2,
    },
  }),
);
