import {
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
  Mic,
  RectangleHorizontal,
  RectangleVertical,
  Video,
  X,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Label, MediaKind, Member } from '@/models';
import type { LabelId, UserId } from '@/types/id';
import { Avatar } from '@/ui/kit/avatar';
import { IconButton } from '@/ui/kit/button';
import { Icon, type IconComponent } from '@/ui/kit/icon';
import { Text } from '@/ui/kit/text';
import { radius, space, themed, useTheme } from '@/ui/theme';
import { LabelMark } from './label';

export type Orientation = 'vertical' | 'horizontal';

export type GalleryFiltersValue = {
  sort: 'new' | 'old';
  kinds: MediaKind[];
  orientations: Orientation[];
  labelIds: LabelId[];
  uploaderIds: UserId[];
};

export const NO_FILTERS: GalleryFiltersValue = {
  sort: 'new',
  kinds: [],
  orientations: [],
  labelIds: [],
  uploaderIds: [],
};

export function isFiltered(value: GalleryFiltersValue): boolean {
  return (
    value.sort !== NO_FILTERS.sort ||
    value.kinds.length > 0 ||
    value.orientations.length > 0 ||
    value.labelIds.length > 0 ||
    value.uploaderIds.length > 0
  );
}

type KindOption = { value: MediaKind; icon: IconComponent; label: string };
type OrientationOption = { value: Orientation; icon: IconComponent; label: string };

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

export function GalleryFiltersPanel({
  value,
  labels,
  members,
  onChange,
}: {
  value: GalleryFiltersValue;
  labels: Label[];
  members: Member[];
  onChange: (next: GalleryFiltersValue) => void;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  const set = <K extends keyof GalleryFiltersValue>(key: K, next: GalleryFiltersValue[K]) =>
    onChange({ ...value, [key]: next });
  const kinds: KindOption[] = [
    { value: 'photo', icon: ImageIcon, label: t('filter.photo') },
    { value: 'video', icon: Video, label: t('filter.video') },
    { value: 'audio', icon: Mic, label: t('filter.audio') },
  ];
  const orientations: OrientationOption[] = [
    { value: 'vertical', icon: RectangleVertical, label: t('filter.vertical') },
    { value: 'horizontal', icon: RectangleHorizontal, label: t('filter.horizontal') },
  ];

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value.sort === 'new' ? t('filter.newest') : t('filter.oldest')}
          onPress={() => set('sort', value.sort === 'new' ? 'old' : 'new')}
          style={styles.side}
        >
          <Icon
            icon={value.sort === 'new' ? ArrowDown : ArrowUp}
            size={16}
            stroke={2.3}
            color={color.paper}
          />
        </Pressable>
        <Text role="control" tone="paper">
          {t('filter.title')}
        </Text>
        <IconButton
          icon={X}
          label={t('filter.reset')}
          tone="ghost"
          size={32}
          onPress={() => onChange(NO_FILTERS)}
          style={styles.side}
        />
      </View>
      <View style={styles.controls}>
        <IconGroup
          label={t('filter.kind')}
          options={kinds}
          selected={value.kinds}
          onToggle={(kind) => set('kinds', toggle(value.kinds, kind))}
        />
        <IconGroup
          label={t('filter.orientation')}
          options={orientations}
          selected={value.orientations}
          onToggle={(orientation) => set('orientations', toggle(value.orientations, orientation))}
        />
      </View>
      <ScrollRow label={t('filter.uploader')}>
        {members.map((member) => {
          const on = value.uploaderIds.includes(member.userId);
          return (
            <Pressable
              key={member.userId}
              accessibilityRole="togglebutton"
              accessibilityLabel={member.name?.trim() || member.username || ''}
              accessibilityState={{ checked: on }}
              onPress={() => set('uploaderIds', toggle(value.uploaderIds, member.userId))}
              style={[styles.avatarCell, { borderColor: on ? color.paper : 'transparent' }]}
            >
              <Avatar name={member.name?.trim() || member.username || ''} size={36} />
            </Pressable>
          );
        })}
      </ScrollRow>
      <ScrollRow label={t('filter.labels')}>
        {labels.map((label) => {
          const on = value.labelIds.includes(label.id);
          return (
            <Pressable
              key={label.id}
              accessibilityRole="togglebutton"
              accessibilityLabel={label.name}
              accessibilityState={{ checked: on }}
              onPress={() => set('labelIds', toggle(value.labelIds, label.id))}
              style={[styles.labelCell, { borderColor: on ? color.paper : 'transparent' }]}
            >
              <LabelMark tint={label.color} size={30} />
            </Pressable>
          );
        })}
      </ScrollRow>
    </View>
  );
}

function IconGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: T; icon: IconComponent; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.group} accessibilityLabel={label}>
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="togglebutton"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(option.value)}
            style={styles.iconCell}
          >
            <Icon
              icon={option.icon}
              size={22}
              stroke={2.2}
              color={on ? color.paper : color.muted}
              fill={on ? color.paper : 'none'}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function ScrollRow({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.rowBlock} accessibilityLabel={label}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    panel: {
      flex: 1,
      padding: space.s4,
      gap: space.s3,
    },
    head: {
      height: 32,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    side: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.s2,
    },
    group: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s1,
      padding: space.s1,
      backgroundColor: color.raise,
      borderRadius: radius.pill,
    },
    iconCell: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    rowBlock: {
      height: 56,
      justifyContent: 'center',
      paddingHorizontal: space.s2,
      backgroundColor: color.raise,
      borderRadius: radius.field,
    },
    rowContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.s2,
      paddingHorizontal: space.s1,
    },
    avatarCell: {
      padding: 2,
      borderWidth: 2,
      borderRadius: radius.pill,
    },
    labelCell: {
      padding: 2,
      borderWidth: 2,
      borderRadius: 12,
    },
  }),
);
