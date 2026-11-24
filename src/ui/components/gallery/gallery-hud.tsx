import { CheckCheck } from 'lucide-react-native';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Label, Member } from '@/models';
import { ActionBar } from '@/ui/kit/controls/action-bar';
import { Button, IconButton } from '@/ui/kit/controls/button';
import { space } from '@/ui/theme';

import { FilterControl } from './filter-control';
import type { GalleryFilterFields, GalleryFiltersValue } from './gallery-filters';
import { GalleryLayer } from './gallery-layer';

export type GalleryPrimary =
  | { kind: 'single'; label: string; onPress: () => void; disabled?: boolean }
  | {
      kind: 'pair';
      back: () => void;
      forward: () => void;
      canBack: boolean;
      canForward: boolean;
    };

type Props = {
  chrome: SharedValue<number>;
  filterAnim: SharedValue<number>;
  actionsOpen: boolean;
  hidden: boolean;
  reveal?: SharedValue<number>;
  filtering: boolean;
  onFilterToggle: () => void;
  filters: GalleryFiltersValue;
  labels: Label[];
  members: Member[];
  filterFields?: GalleryFilterFields;
  onFiltersChange: (value: GalleryFiltersValue) => void;
  primary?: GalleryPrimary;
  keepPrimary?: boolean;
  rightButtons?: number;
  selecting: boolean;
  canSelect: boolean;
  onSelectingToggle: () => void;
  selectionTools?: ReactNode;
  renderSelectionActions?: (progress: SharedValue<number>) => ReactNode;
  bottom: number;
};

export function GalleryHud({
  chrome,
  filterAnim,
  actionsOpen,
  hidden,
  reveal,
  filtering,
  onFilterToggle,
  filters,
  labels,
  members,
  filterFields,
  onFiltersChange,
  primary,
  keepPrimary = false,
  rightButtons = 1,
  selecting,
  canSelect,
  onSelectingToggle,
  selectionTools,
  renderSelectionActions,
  bottom,
}: Props) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const actions = useSharedValue(0);
  const primaryFade = useSharedValue(1);

  useEffect(() => {
    actions.value = withTiming(selecting ? 1 : 0, { duration: 200 });
  }, [actions, selecting]);

  useEffect(() => {
    primaryFade.value = withTiming(filtering ? 0 : 1, { duration: 200 });
  }, [filtering, primaryFade]);

  const full = width - space.s4 * 2;
  const narrow = Math.max(140, full - (60 + 60 * rightButtons));
  const primaryStyle = useAnimatedStyle(() => ({
    marginHorizontal: 'auto',
    opacity: primaryFade.value * (keepPrimary ? 1 : 1 - chrome.value),
    width: keepPrimary
      ? interpolate(chrome.value, [0, 1], [full, narrow], Extrapolation.CLAMP)
      : full,
    transform: keepPrimary ? [] : [{ translateY: chrome.value * 96 }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: chrome.value,
    transform: [{ translateX: (1 - chrome.value) * 72 }],
  }));

  return (
    <GalleryLayer hidden={hidden} reveal={reveal}>
      {primary ? (
        <ActionBar>
          <Animated.View
            style={primaryStyle}
            pointerEvents={filtering || (!keepPrimary && actionsOpen) ? 'none' : 'auto'}
          >
            {primary.kind === 'single' ? (
              <Button
                label={primary.label}
                variant="primary"
                wide={false}
                disabled={primary.disabled}
                onPress={primary.onPress}
                style={styles.primaryBtn}
              />
            ) : (
              <View style={styles.pair}>
                <View style={styles.pairCell}>
                  <Button
                    label={t('action.back')}
                    variant="secondary"
                    disabled={!primary.canBack}
                    onPress={primary.back}
                  />
                </View>
                <View style={styles.pairCell}>
                  <Button
                    label={t('montage.order.next')}
                    variant="primary"
                    disabled={!primary.canForward}
                    onPress={primary.forward}
                  />
                </View>
              </View>
            )}
          </Animated.View>
        </ActionBar>
      ) : null}
      {filtering ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('action.close')}
          onPress={onFilterToggle}
          style={styles.backdrop}
        />
      ) : null}
      <View
        pointerEvents={actionsOpen ? 'box-none' : 'none'}
        style={[styles.sideBar, { bottom: bottom - space.s1 }]}
      >
        <FilterControl
          chrome={chrome}
          anim={filterAnim}
          filtering={filtering}
          full={full}
          onToggle={onFilterToggle}
          filters={filters}
          labels={labels}
          members={members}
          fields={filterFields}
          onChange={onFiltersChange}
        />
        <Animated.View style={[rightStyle, styles.right]}>
          {selecting ? selectionTools : null}
          {canSelect ? (
            <IconButton
              icon={CheckCheck}
              label={selecting ? t('action.done') : t('project.select')}
              tone="surface"
              size={52}
              on={selecting}
              onPress={onSelectingToggle}
            />
          ) : null}
        </Animated.View>
      </View>
      {selecting && actionsOpen && renderSelectionActions ? renderSelectionActions(actions) : null}
    </GalleryLayer>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    width: '100%',
  },
  pair: {
    flexDirection: 'row',
    gap: space.s2,
  },
  pairCell: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  sideBar: {
    position: 'absolute',
    left: space.s4,
    right: space.s4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
});
