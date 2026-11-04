import { Lock, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Animated,
  PanResponder,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  editMedia,
  type FrameInfo,
  fetchFrameInfo,
  type Label,
  type MediaItem,
  memberName,
  removeLabelMedia,
} from '@/api';
import {
  Avatar,
  Banner,
  Chip,
  IconButton,
  RowEdit,
  RowFilmAt,
  RowSummary,
  ShotCells,
  Spinner,
  Text,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatDay, formatDayShort, formatRuntime, formatTime } from '@/lib/dates';
import { type Failure, failure } from '@/lib/failure';
import { frameFacts, shotCells } from '@/lib/frames';
import { usePlaceName } from '@/lib/geocoder';
import { letGo, SIDEWAYS } from '@/lib/gesture';
import { labelTint } from '@/lib/labels';
import { useStrings } from '@/lib/language';
import { FrameComments } from '@/screens/memory/frame-comments';
import { LabelSheets } from '@/screens/memory/label-sheets';
import { ShotEditor } from '@/screens/mine/shot-editor';
import { board, height, radius, space, themed, useTheme } from '@/theme';
export function FrameInfoPanel({
  memoryId,
  item,
  onFilm,
  onEdited,
  style,
  rise,
  onLetGo,
}: {
  memoryId: string;
  item: MediaItem;
  onFilm: (montageId: string) => void;
  onEdited: (item: MediaItem) => void;
  style?: StyleProp<ViewStyle>;
  rise?: Animated.Value;
  onLetGo?: (goes: boolean) => void;
}) {
  const { token, user } = useAuth();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<FrameInfo | null>(null);
  const [failed, setFailed] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [filing, setFiling] = useState(false);
  const [editingShot, setEditingShot] = useState(false);
  const [savingShot, setSavingShot] = useState(false);
  const place = usePlaceName(info?.latitude, info?.longitude);
  const down = useRef(0);
  const tall = useRef(0);
  const carry = useRef(rise);
  carry.current = rise;
  const letGoOf = useRef(onLetGo);
  letGoOf.current = onLetGo;
  const pull = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          down.current <= 0 && g.dy > SIDEWAYS && g.dy > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          const how = Math.max(1, tall.current);
          carry.current?.setValue(Math.max(0, Math.min(1, 1 - g.dy / how)));
        },
        onPanResponderRelease: (_, g) => letGoOf.current?.(letGo(g)),
        onPanResponderTerminate: () => letGoOf.current?.(false),
      }).panHandlers,
    [],
  );
  const asking = useRef(0);
  const read = useCallback(
    (clear: boolean) => {
      if (clear) {
        setInfo(null);
        setFailed(null);
      }
      if (!token) return;
      const mine = ++asking.current;
      fetchFrameInfo(token, memoryId, item.id).then(
        (got) => {
          if (asking.current === mine) setInfo(got);
        },
        (e: unknown) => {
          if (asking.current === mine) setFailed(failure(e));
        },
      );
    },
    [token, memoryId, item.id],
  );
  useEffect(() => {
    read(true);
    return () => {
      asking.current++;
    };
  }, [read]);
  async function takeOut(label: Label): Promise<void> {
    if (!token || busy) return;
    setBusy(true);
    setFailed(null);
    try {
      await removeLabelMedia(token, memoryId, label.id, [item.id]);
      setInfo((was) =>
        was === null ? was : { ...was, labels: was.labels.filter((one) => one.id !== label.id) },
      );
    } catch (e) {
      setFailed(failure(e));
    } finally {
      setBusy(false);
    }
  }
  async function changeShot(at: Date): Promise<void> {
    if (!token) return;
    const captured_at = at.toISOString();
    setSavingShot(true);
    setFailed(null);
    try {
      await editMedia(token, memoryId, item.id, { captured_at });
      setInfo((was) => (was === null ? was : { ...was, captured_at }));
      onEdited({ ...item, captured_at });
      setEditingShot(false);
    } catch (e) {
      setFailed(failure(e));
    } finally {
      setSavingShot(false);
    }
  }
  const marked = useMemo(
    () => [{ ...item, label_ids: (info?.labels ?? []).map((one) => one.id) }],
    [item, info],
  );
  const theme = useTheme();
  return (
    <View
      style={[styles.panel, style]}
      onLayout={(e) => {
        tall.current = e.nativeEvent.layout.height;
      }}
      {...pull}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: Math.max(insets.bottom, board.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          down.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {failed === null ? null : <Banner tone="error" failure={failed} />}

        {info === null ? (
          failed === null ? (
            <View style={styles.waiting}>
              <Spinner />
            </View>
          ) : null
        ) : (
          <>
            {info.comments === undefined ? null : (
              <FrameComments
                memoryId={memoryId}
                mediaId={item.id}
                comments={info.comments}
                onSent={(comment) =>
                  setInfo((was) =>
                    was === null ? was : { ...was, comments: [...(was.comments ?? []), comment] },
                  )
                }
                onGone={(id) =>
                  setInfo((was) =>
                    was === null
                      ? was
                      : {
                          ...was,
                          comments: (was.comments ?? []).filter((one) => one.id !== id),
                        },
                  )
                }
              />
            )}

            {info.labels.length === 0 ? null : (
              <View style={styles.labels}>
                <Text role="meta" tone="muted">
                  {s.gallery.whichLabels}
                </Text>
                <View style={styles.chips}>
                  {info.labels.map((label) => (
                    <Chip
                      key={label.id}
                      size={height.chipXs}
                      label={label.title}
                      swatch={labelTint(label.color, theme)}
                      icon={label.shared ? undefined : Lock}
                      name={s.labels.takeOut(label.title)}
                      disabled={!label.can_add_media || busy}
                      onPress={label.can_add_media ? () => void takeOut(label) : undefined}
                      style={styles.chip}
                    />
                  ))}
                  <IconButton
                    icon={Plus}
                    label={s.labels.putInto}
                    size={height.chipXs}
                    tone="outline"
                    onPress={() => setFiling(true)}
                  />
                </View>
              </View>
            )}

            <View style={styles.author}>
              <Avatar name={memberName(info.uploaded_by)} size={32} />
              <View style={styles.authorWords}>
                <Text role="rowSm">{memberName(info.uploaded_by)}</Text>
                <Text role="meta">
                  {s.viewer.brought(formatDayShort(info.created_at), info.uploaded_by.media_count)}
                </Text>
              </View>
            </View>

            <View style={styles.facts}>
              <RowEdit
                value={
                  info.captured_at
                    ? `${formatDay(info.captured_at)}, ${formatTime(info.captured_at)}`
                    : s.mine.none
                }
                edit={s.viewer.editShot}
                onEdit={info.uploaded_by.id === user?.id ? () => setEditingShot(true) : undefined}
              />
              {editingShot ? (
                <ShotEditor
                  from={info.captured_at}
                  busy={savingShot}
                  onSave={(at) => void changeShot(at)}
                />
              ) : null}
              {frameFacts(info, s, undefined, place).map((fact) => (
                <RowSummary key={fact.label} label={fact.label} value={fact.value} divider />
              ))}

              <ShotCells cells={shotCells(info, s)} />
            </View>

            {info.montages.length === 0 ? null : (
              <View style={styles.group}>
                <Text role="meta" accessibilityRole="header">
                  {s.viewer.inFilms}
                </Text>
                {info.montages.map((film) => {
                  const runtime = formatRuntime(film.duration_seconds);
                  return (
                    <RowFilmAt
                      key={`${film.id}:${film.start_seconds}`}
                      title={runtime ? s.montage.ofLength(runtime) : s.montage.count(1)}
                      at={s.viewer.at(formatRuntime(film.start_seconds) ?? '')}
                      onPress={() => onFilm(film.id)}
                    />
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {filing && info !== null ? (
        <LabelSheets
          memoryId={memoryId}
          frames={marked}
          onFiled={() => read(false)}
          onClose={() => {
            setFiling(false);
            read(false);
          }}
        />
      ) : null}
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    panel: {
      backgroundColor: color.surface,
      borderTopWidth: 1,
      borderColor: color.line,
    },
    scroll: { flexGrow: 0 },
    body: { gap: 14, paddingTop: space.s3, paddingHorizontal: space.s4 },
    group: { gap: space.s2 },
    labels: { gap: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    chip: { backgroundColor: color.ink, borderColor: color.line },
    author: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: space.s3,
      borderRadius: radius.cell,
      backgroundColor: color.ink,
      borderWidth: 1,
      borderColor: color.line,
    },
    authorWords: { flex: 1, minWidth: 0, gap: 1 },
    facts: { marginHorizontal: -space.s4 },
    waiting: { alignItems: 'center', paddingVertical: space.s5 },
  }),
);
