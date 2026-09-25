import { Image } from 'expo-image';
import { TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

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
  /**
   * Or the memory it is about (`SheetConfirmMemory`): its cover at 64, by the chain it is shown by
   * everywhere — the chosen frame, else the mosaic of its frames, else the dashed frame.
   */
  cover?: { uri?: string | null; thumbs?: readonly string[] };
  /**
   * «Марк Ковалёв · 13 сентября», «Свадьба Лизы и Марка · 486 кадров». Under a cover it is one line,
   * cut if long (`SheetConfirmMemory`); elsewhere it wraps — over an armful of frames it is the
   * sentence saying why fewer go than were marked, and cut short that says nothing.
   */
  meta?: string;
  /**
   * The price named as a number, on a plate of its own: «54 кадра исчезнут из воспоминания». Spec 9
   * asks for it before the press and not after, which is the whole reason this sheet exists.
   */
  price?: string;
  /**
   * What that plate stands on. Red for a person taken out (`SheetConfirmMember`); `ink` for a memory
   * deleted (`SheetConfirmMemory`), where red is only in the sign and the words — the plate names the
   * part of the loss that was never the deleter's own, and must not shout over the red button under it.
   */
  priceOn?: 'danger' | 'ink';
  /**
   * The request is in the air: the dangerous button waits, and neither «Оставить» nor a tap beside
   * the sheet can promise to keep what is already being taken down.
   */
  busy?: boolean;
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
  cover,
  meta,
  price,
  priceOn = 'danger',
  busy,
  variant = 'danger',
}: ConfirmProps) {
  const { color } = useTheme();
  const styles = useStyles();
  const gentle = variant === 'gentle';
  // One 64 mark, whichever of the four this sheet is about.
  const mark = gentle ? null : thumb ? (
    <Image source={{ uri: thumb }} contentFit="cover" style={styles.thumb} />
  ) : cover ? (
    <CoverSlot {...cover} size={64} />
  ) : who ? (
    <Avatar name={who} size={64} />
  ) : tint ? (
    <LabelMark tint={tint} size={64} />
  ) : null;
  const ink = priceOn === 'ink';
  // Spec 4 draws each confirmation by what it is about: a memory's 434, a person's 420, a frame's —
  // and a label's (10.8.1), or an armful of frames with no picture yet — 380. The gentle kind is
  // nobody's drawing, so it is as tall as what it holds.
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
      // The line under the question stands with no picture beside it too: an armful whose first
      // frame has no thumbnail yet still says why fewer go than were marked.
      head={
        <View style={styles.head}>
          {mark}
          <View style={styles.headWords}>
            <Text role="sheetTitleSm" accessibilityRole="header">
              {title}
            </Text>
            {meta ? (
              <Text role="meta" numberOfLines={cover ? 1 : undefined}>
                {meta}
              </Text>
            ) : null}
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
      <Text role="bodySm" tone="muted">
        {text}
      </Text>
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
    </Sheet>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Spec 8, every confirmation sheet as drawn: 14 between the mark and the words, 7 between the
    // question and the line under it.
    head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    headWords: { flex: 1, minWidth: 0, gap: 7 },
    thumb: { width: 64, height: 64, borderRadius: radius.strip, backgroundColor: color.raise },
    // Spec 7.1, detail 8 — the plate on red, as `SheetConfirmMember` draws it: 16 round, 12 / 14
    // inside, 11 between sign and words.
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
    // And on `ink`: 18 round, 10 between sign and words, the words 13 / 18.
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
