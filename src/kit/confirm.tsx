import { Image } from 'expo-image';
import { TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { radius, space, themed, useTheme } from '@/theme';

import { Button } from './button';
import { Icon } from './icon';
import { LabelMark } from './label';
import { Avatar } from './member';
import { Sheet } from './sheet';
import { Text } from './text';

type ConfirmProps = {
  visible: boolean;
  title: string;
  /** The consequence, spelled out. The question is what will be lost, never «are you sure». */
  text: string;
  /** The verb from the title — «Удалить», «Убрать», never «ОК». */
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** The frame this is about — a 64 thumbnail in the header row. */
  thumb?: string;
  /** Or the person it is about — a 64 avatar in the same place. */
  who?: string;
  /**
   * Or the label it is about (spec 10.8.1): the 64 square of its own colour with a tag in it, where
   * the thumbnail would be. A label has no picture of its own, and a box is known by its colour.
   */
  tint?: string;
  /** «Марк Ковалёв · 13 сентября», «@anya.p · принесла 54 кадра». */
  meta?: string;
  /**
   * The price named as a number, on a plate of its own: «54 кадра исчезнут из воспоминания». Spec 9
   * asks for it before the press and not after, which is the whole reason this sheet exists.
   */
  price?: string;
  /**
   * Spec 7.1, detail 8 — the kind asked when nothing is lost: leaving an account, walking away from
   * edits nobody saved. No thumbnail, no avatar, and the button at the bottom is `paper` rather than
   * red, with a quiet way out under it. The dangerous red never appears here, or it stops meaning
   * «навсегда» where it does appear.
   */
  variant?: 'danger' | 'gentle';
};

/**
 * Spec 7.1 and «Пусто и необратимое» — what cannot be undone is asked on a sheet that names the
 * cost. This stands in for `Alert.alert` on delete, leave and remove: the system dialog has neither
 * the shape nor the wording.
 *
 * The bottom block is the dangerous-plus-outlined kind: the way out is never the quiet one here,
 * because «Оставить» has to be as easy to hit as «Удалить».
 */
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
  meta,
  price,
  variant = 'danger',
}: ConfirmProps) {
  const { color } = useTheme();
  const styles = useStyles();
  const gentle = variant === 'gentle';
  // One 64 mark, whichever of the three this sheet is about.
  const marked = thumb || who || tint;

  return (
    <Sheet
      visible={visible}
      onCancel={onCancel}
      narrow
      head={
        marked && !gentle ? (
          <View style={styles.head}>
            {thumb ? (
              <Image source={{ uri: thumb }} contentFit="cover" style={styles.thumb} />
            ) : null}
            {who && !thumb ? <Avatar name={who} size={64} /> : null}
            {tint && !thumb && !who ? <LabelMark tint={tint} size={64} /> : null}
            <View style={styles.headWords}>
              <Text role="sheetTitleSm" accessibilityRole="header">
                {title}
              </Text>
              {meta ? <Text role="meta">{meta}</Text> : null}
            </View>
          </View>
        ) : undefined
      }
      title={marked && !gentle ? undefined : title}
      footer={
        <>
          <Button variant={gentle ? 'paper' : 'danger'} label={confirmLabel} onPress={onConfirm} />
          <Button
            variant={gentle ? 'quiet' : 'secondary'}
            size="md"
            wide
            label={cancelLabel}
            onPress={onCancel}
          />
        </>
      }
    >
      <Text role="body" tone="muted">
        {text}
      </Text>
      {price ? (
        <View style={styles.price}>
          <Icon icon={TriangleAlert} size={18} color={color.dangerText} />
          <Text role="label" tone="danger" style={styles.grow}>
            {price}
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    headWords: { flex: 1, minWidth: 0, gap: 2 },
    thumb: { width: 64, height: 64, borderRadius: radius.strip, backgroundColor: color.raise },
    price: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      padding: space.s3,
      borderRadius: radius.cell,
      backgroundColor: color.dangerSoft,
      borderWidth: 1,
      borderColor: color.dangerEdge,
    },
    grow: { flex: 1, minWidth: 0 },
  }),
);
