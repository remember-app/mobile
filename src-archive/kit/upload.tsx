import { ChevronDown, TriangleAlert, X } from 'lucide-react-native';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { height, radius, space, themed, useTheme } from '@/theme';
import { Divider, Progress } from './bits';
import { Button, IconButton } from './button';
import { Icon } from './icon';
import { useFocusRing, useHoverFocus } from './interaction';
import { Text } from './text';
export function Upload({
  title,
  meta,
  value,
  hint,
  style,
}: {
  title: string;
  meta?: string;
  value: number;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.upload, style]}>
      <View style={styles.head}>
        <Text role="subtitleDisplay" style={styles.lead}>
          {title}
        </Text>

        {meta ? (
          <Text role="label" tone="muted">
            {meta}
          </Text>
        ) : null}
      </View>
      <Progress value={value} label={meta ?? title} />

      {hint ? (
        <Text role="noteSm" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
export function UploadLine({
  title,
  meta,
  value = 0,
  failed,
  action,
  label,
  onPress,
  style,
}: {
  title?: string;
  meta?: string;
  value?: number;
  failed?: string;
  action: string;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  const { focused, props } = useHoverFocus();
  const focusRing = useFocusRing();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      {...props}
      style={[styles.line, focused ? focusRing : null, style]}
    >
      {title ? (
        <>
          <View style={styles.lineTop}>
            <Text role="row" style={styles.lead}>
              {title}
            </Text>
            {meta ? (
              <Text role="timecode" tone="muted">
                {meta}
              </Text>
            ) : null}
          </View>
          <Progress value={value} />
        </>
      ) : null}
      {failed ? (
        <View style={styles.lineFailed}>
          <Icon icon={TriangleAlert} size={14} stroke={1.9} color={color.dangerText} />
          <Text role="meta" tone="danger" style={styles.lead}>
            {failed}
          </Text>
          <Text role="timecode" tone="muted">
            {action}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
export type StuckLine = {
  key: string;
  name: string;
  reason: string;
  dropLabel: string;
  onDrop: () => void;
};
const SHOWN = 2;
export function BlockStuck({
  title,
  retry,
  lines,
  open,
  onToggle,
  more,
  less,
  style,
}: {
  title: string;
  retry: {
    label: string;
    onPress: () => void;
  };
  lines: readonly StuckLine[];
  open: boolean;
  onToggle: () => void;
  more: string;
  less: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  const folds = lines.length > SHOWN;
  const shown = folds && !open ? lines.slice(0, SHOWN) : lines;
  return (
    <View accessibilityLabel={title} style={[styles.stuck, style]}>
      <View style={styles.stuckHead}>
        <Icon icon={TriangleAlert} size={18} stroke={1.9} color={color.dangerText} />
        <Text role="row" style={styles.lead}>
          {title}
        </Text>
        <Button
          variant="secondary"
          size="xxs"
          wide={false}
          label={retry.label}
          onPress={retry.onPress}
        />
      </View>
      <Divider style={styles.stuckRule} />
      {shown.map((line, index) => (
        <View key={line.key}>
          {index > 0 ? <Divider soft /> : null}
          <View style={styles.file}>
            <View style={styles.words}>
              <Text role="rowSm" numberOfLines={1}>
                {line.name}
              </Text>
              <Text role="meta" tone="danger">
                {line.reason}
              </Text>
            </View>
            <IconButton
              icon={X}
              size={height.roundRow}
              glyph={{ size: 15, stroke: 2 }}
              tint={color.faint}
              label={line.dropLabel}
              onPress={line.onDrop}
              style={styles.drop}
            />
          </View>
        </View>
      ))}
      {folds ? (
        <>
          <Divider />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={onToggle}
            style={styles.fold}
          >
            <Text role="label" tone="muted">
              {open ? less : more}
            </Text>
            <View style={open ? styles.flipped : null}>
              <Icon icon={ChevronDown} size={15} stroke={2} color={color.muted} />
            </View>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    upload: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      padding: space.s4,
      gap: space.s3,
    },
    head: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: space.s3,
      rowGap: space.s1,
    },
    lead: { flexGrow: 1, flexShrink: 1 },
    line: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      paddingVertical: 13,
      paddingHorizontal: space.s4,
      gap: 9,
    },
    lineTop: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      columnGap: space.s3,
    },
    lineFailed: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stuck: {
      borderRadius: radius.section,
      borderWidth: 1,
      borderColor: color.dangerEdge,
      backgroundColor: color.surface,
      paddingVertical: 14,
      paddingHorizontal: space.s4,
    },
    stuckHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    stuckRule: { marginTop: space.s3 },
    file: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
    words: { flex: 1, minWidth: 0, gap: 2 },
    drop: { marginRight: -6 },
    fold: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: -6,
    },
    flipped: { transform: [{ rotate: '180deg' }] },
  }),
);
