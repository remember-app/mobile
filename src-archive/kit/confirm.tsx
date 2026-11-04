import { Image } from 'expo-image';
import { TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { pictureKey } from '@/lib/picture-key';
import { height, radius, space, themed, useTheme } from '@/theme';
import { Button } from './button';
import { CoverSlot } from './cover';
import { Icon } from './icon';
import { LabelMark } from './label';
import { Avatar } from './member';
import { Sheet } from './sheet';
import { Text } from './text';

type ConfirmProps = {
  visible: boolean;
  title: string;
  text?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  thumb?: string;
  who?: string;
  tint?: string;
  cover?: {
    uri?: string | null;
    thumbs?: readonly string[];
  };
  meta?: string;
  price?: string;
  priceOn?: 'danger' | 'ink';
  busy?: boolean;
  error?: string;
  variant?: 'danger' | 'gentle';
};
export function ConfirmSheet({
  visible,
  title,
  text,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  thumb,
  who,
  tint,
  cover,
  meta,
  price,
  priceOn = 'danger',
  busy,
  error,
  variant = 'danger',
}: ConfirmProps) {
  const { color } = useTheme();
  const styles = useStyles();
  const gentle = variant === 'gentle';
  const mark = gentle ? null : thumb ? (
    <Image
      source={{ uri: thumb, cacheKey: pictureKey(thumb) }}
      contentFit="cover"
      style={styles.thumb}
    />
  ) : cover ? (
    <CoverSlot {...cover} size={64} />
  ) : who ? (
    <Avatar name={who} size={64} />
  ) : tint ? (
    <LabelMark tint={tint} size={64} />
  ) : null;
  const ink = priceOn === 'ink';
  const floor = gentle
    ? undefined
    : cover
      ? height.sheetConfirmMemory
      : who
        ? height.sheetConfirmMember
        : height.sheetConfirmDelete;
  return (
    <Sheet
      visible={visible}
      onCancel={busy ? () => {} : onCancel}
      height={floor}
      head={
        <View style={styles.head}>
          {mark}
          <View style={styles.headWords}>
            <Text role="sheetTitleSm" accessibilityRole="header">
              {title}
            </Text>
            {meta ? <Text role="meta">{meta}</Text> : null}
          </View>
        </View>
      }
      footer={
        <>
          <Button
            variant={gentle ? 'paper' : 'danger'}
            label={confirmLabel}
            onPress={onConfirm}
            busy={busy}
          />
          <Button
            variant={gentle ? 'quiet' : 'secondary'}
            size="md"
            wide
            label={cancelLabel}
            onPress={onCancel}
            disabled={busy}
          />
        </>
      }
    >
      {text ? (
        <Text role="bodySm" tone="muted">
          {text}
        </Text>
      ) : null}
      {price ? (
        <View style={[styles.price, ink ? styles.priceInk : null]}>
          <Icon icon={TriangleAlert} size={18} color={color.dangerText} />
          <Text
            role={ink ? 'note' : 'label'}
            tone="danger"
            style={[styles.grow, ink ? styles.priceInkWords : null]}
          >
            {price}
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text role="note" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    headWords: { flex: 1, minWidth: 0, gap: 7 },
    thumb: { width: 64, height: 64, borderRadius: radius.strip, backgroundColor: color.raise },
    price: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingVertical: space.s3,
      paddingHorizontal: 14,
      borderRadius: radius.cell,
      backgroundColor: color.dangerSoft,
      borderWidth: 1,
      borderColor: color.dangerEdge,
    },
    priceInk: {
      gap: 10,
      borderRadius: radius.field,
      backgroundColor: color.ink,
      borderColor: color.line,
    },
    priceInkWords: { lineHeight: 18 },
    grow: { flex: 1, minWidth: 0 },
  }),
);
