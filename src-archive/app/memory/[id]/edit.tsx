import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ApiError,
  listMedia,
  listMemories,
  type MediaItem,
  type Memory,
  updateMemory,
} from '@/api';
import {
  ActionBar,
  AppBar,
  BackButton,
  Banner,
  Board,
  Button,
  ConfirmSheet,
  CoverSlot,
  Field,
  Hint,
  Text,
  Waiting,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { endOfDay, formatDay, startOfDay } from '@/lib/dates';
import { type Failure, failure, notMember } from '@/lib/failure';
import { mayPick, shotAt } from '@/lib/frames';
import { useStrings } from '@/lib/language';
import { CoverSheet } from '@/screens/memory/cover';
import { EventWhen, type Span } from '@/screens/memory/when';
import { board, height, radius, space, themed } from '@/theme';
export default function MemoryEditScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [media, setMedia] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [span, setSpan] = useState<Span | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!token) return;
    listMemories(token).then(
      (list) => {
        const one = list.find((each) => each.id === id) ?? null;
        setMemory(one);
        if (one === null) return setError(failure(new ApiError(404, null), notMember(s)));
        setTitle(one.title);
        setSpan(spanOf(one));
        setCover(one.cover_media_id);
      },
      (e: unknown) => setError(failure(e)),
    );
    listMedia(token, id).then(setMedia, () => {});
  }, [token, id]);
  const ready = memory !== null && title !== null && span !== null;
  const pickable = (media ?? []).filter(mayPick);
  const chosen = cover === null ? null : ((media ?? []).find((item) => item.id === cover) ?? null);
  const coverUri =
    chosen?.thumbnail_url ??
    (cover !== null && cover === memory?.cover_media_id ? memory.cover_thumbnail_url : null);
  const named = title?.trim() ?? '';
  const changed =
    ready &&
    (named !== memory.title || cover !== memory.cover_media_id || !sameSpan(span, spanOf(memory)));
  const leave = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/memory/[id]/settings', params: { id } });
  async function save() {
    if (!token || !ready || !changed || named === '') return;
    setSaving(true);
    setFailed(null);
    try {
      await updateMemory(token, id, {
        ...(named === memory.title ? {} : { title: named }),
        ...(sameSpan(span, spanOf(memory))
          ? {}
          : {
              event_start: startOfDay(span.from).toISOString(),
              event_end: span.to === null ? null : endOfDay(span.to).toISOString(),
            }),
        ...(cover === memory.cover_media_id ? {} : { cover_media_id: cover }),
      });
      leave();
    } catch {
      setFailed(s.edit.failed);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Board
      bar={
        <AppBar
          title={s.edit.title}
          left={
            <BackButton
              label={s.action.back}
              onPress={() => (changed ? setLeaving(true) : leave())}
            />
          }
        />
      }
      footer={
        <ActionBar>
          <Button
            variant="primary"
            wide
            label={s.edit.save}
            busy={saving}
            disabled={!changed || named === ''}
            onPress={() => void save()}
          />
        </ActionBar>
      }
      body={styles.body}
    >
      {failed !== null ? <Banner tone="error" text={failed} /> : null}

      {error !== null ? (
        <Banner tone="error" failure={error} />
      ) : !ready ? (
        <View style={styles.middle}>
          <Waiting text={s.state.loading} />
        </View>
      ) : (
        <>
          <View style={styles.block}>
            <Text role="eyebrow" tone="muted" accessibilityRole="header">
              {s.create.titleLabel.toUpperCase()}
            </Text>
            <Field
              label={s.create.titleLabel}
              labelHidden
              variant="name"
              value={title}
              onChangeText={setTitle}
              placeholder={s.create.titlePlaceholder}
              editable={!saving}
              state={named === '' ? 'error' : undefined}
              hint={named === '' ? s.edit.noTitle : undefined}
            />
          </View>

          <EventWhen value={span} onChange={setSpan} disabled={saving} />

          <View style={styles.block}>
            <Text role="eyebrow" tone="muted" accessibilityRole="header">
              {s.edit.cover.toUpperCase()}
            </Text>
            <View style={styles.card}>
              <CoverSlot uri={coverUri} thumbs={memory.recent_thumbnail_urls} />
              <View style={styles.grow}>
                <Text role="row">
                  {cover === null
                    ? s.edit.coverNone
                    : chosen
                      ? s.edit.coverFrom(formatDay(new Date(shotAt(chosen))))
                      : s.edit.coverChosen}
                </Text>
                <Text role="meta">{cover === null ? s.edit.coverInstead : s.edit.coverWhere}</Text>
              </View>
              <Button
                variant="small"
                size="xs"
                label={cover === null ? s.edit.coverPick : s.edit.coverReplace}
                disabled={saving || pickable.length === 0}
                onPress={() => setPicking(true)}
              />
            </View>

            {cover === null ? null : (
              <Button
                variant="quiet"
                label={s.edit.coverDrop}
                disabled={saving}
                style={styles.quiet}
                onPress={() => setCover(null)}
              />
            )}

            {media !== null && pickable.length === 0 ? (
              <Hint>{s.edit.coverNeedsFrames}</Hint>
            ) : null}
          </View>
        </>
      )}

      <CoverSheet
        visible={picking}
        onCancel={() => setPicking(false)}
        media={media ?? []}
        chosen={cover}
        onChoose={(mediaId) => {
          setCover(mediaId);
          setPicking(false);
        }}
      />

      <ConfirmSheet
        visible={leaving}
        variant="gentle"
        title={s.edit.leaveAsk}
        text={s.edit.leaveText}
        confirmLabel={s.edit.leaveDo}
        cancelLabel={s.edit.stay}
        onConfirm={() => {
          setLeaving(false);
          leave();
        }}
        onCancel={() => setLeaving(false)}
      />
    </Board>
  );
}
function spanOf(memory: Memory): Span {
  const from = startOfDay(new Date(memory.event_start));
  const to = memory.event_end === null ? null : startOfDay(new Date(memory.event_end));
  return { from, to: to !== null && to > from ? to : null };
}
const sameSpan = (a: Span, b: Span) =>
  startOfDay(a.from).getTime() === startOfDay(b.from).getTime() &&
  (a.to === null ? null : startOfDay(a.to).getTime()) ===
    (b.to === null ? null : startOfDay(b.to).getTime());
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    body: {
      flexGrow: 1,
      paddingTop: board.bodySettings - board.status - height.bar,
      paddingHorizontal: space.s4,
      paddingBottom: space.s6,
      gap: 22,
    },
    middle: { flexGrow: 1, justifyContent: 'center' },
    block: { gap: 9 },
    card: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: space.s3,
      padding: space.s3,
      borderRadius: radius.card,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
    },
    grow: { flex: 1, minWidth: '50%' },
    quiet: { alignSelf: 'flex-start' },
  }),
);
