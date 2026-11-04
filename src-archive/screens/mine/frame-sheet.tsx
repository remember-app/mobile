import { Image } from 'expo-image';
import { EyeOff, MapPin, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { editMedia, type FrameInfo, fetchFrameInfo, type MediaEdit, type MediaItem } from '@/api';
import { Banner, Button, Field, RowCard, RowDo, RowProp, Sheet, Text } from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatDay, formatTime } from '@/lib/dates';
import { type Failure, failure } from '@/lib/failure';
import { megabytes } from '@/lib/frames';
import { findPlace, usePlaceName } from '@/lib/geocoder';
import { useStrings } from '@/lib/language';
import { parkedReason, progress, type QueuedFile } from '@/lib/upload/queue';
import { ShotEditor } from '@/screens/mine/shot-editor';
import { radius, space, themed } from '@/theme';
export type Own =
  | {
      key: string;
      at: number;
      item: MediaItem;
      file?: undefined;
    }
  | {
      key: string;
      at: number;
      file: QueuedFile;
      item?: undefined;
    };
type Busy = 'shot' | 'place' | 'hide';
export function FrameSheet({
  memoryId,
  own,
  onEdited,
  onRemove,
  onClose,
}: {
  memoryId: string;
  own: Own;
  onEdited: (item: MediaItem) => void;
  onRemove: (item: MediaItem) => void;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const s = useStrings();
  const styles = useStyles();
  const item = own.item;
  const [info, setInfo] = useState<FrameInfo | null>(null);
  const [notice, setNotice] = useState<Failure | null>(null);
  const [editing, setEditing] = useState<'shot' | 'place' | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  useEffect(() => {
    if (!token || !item) return;
    let live = true;
    fetchFrameInfo(token, memoryId, item.id).then(
      (read) => live && setInfo(read),
      (e: unknown) => live && setNotice(failure(e)),
    );
    return () => {
      live = false;
    };
  }, [token, memoryId, item?.id]);
  const place = usePlaceName(info?.latitude, info?.longitude);
  async function change(what: Busy, edit: MediaEdit): Promise<boolean> {
    if (!token || !item) return false;
    setBusy(what);
    setNotice(null);
    try {
      await editMedia(token, memoryId, item.id, edit);
      return true;
    } catch (e) {
      setNotice(failure(e));
      return false;
    } finally {
      setBusy(null);
    }
  }
  async function hide() {
    if (!item) return;
    const hidden = !item.hidden;
    if (!(await change('hide', { hidden }))) return;
    onEdited({ ...item, hidden });
    onClose();
  }
  const name = info?.file_name ?? own.file?.filename ?? s.media[item?.kind ?? 'photo'];
  const shot = info?.captured_at ?? item?.captured_at ?? null;
  const where =
    info?.latitude != null && info.longitude != null
      ? place || s.viewer.coords(info.latitude, info.longitude)
      : undefined;
  const shape = info ?? item;
  const facts = own.file
    ? [
        own.file.size ? sizeOf(s, String(own.file.size)) : null,
        own.file.error
          ? parkedReason(s, own.file.error)
          : s.mine.sending(`${Math.round(progress(own.file) * 100)}%`),
      ]
    : [
        sizeOf(s, shape?.size_bytes),
        shape?.width && shape.height ? `${shape.width} × ${shape.height}` : null,
      ];
  const thumb = item ? (item.thumbnail_url ?? undefined) : own.file?.uri;
  return (
    <Sheet
      visible
      onCancel={onClose}
      rhythm="list"
      head={
        <View style={styles.head}>
          {thumb ? <Image source={{ uri: thumb }} contentFit="cover" style={styles.thumb} /> : null}
          <View style={styles.headWords}>
            <Text role="row" numberOfLines={1} ellipsizeMode="middle" style={styles.name}>
              {name}
            </Text>
            <Text role="meta">{facts.filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
      }
    >
      {notice !== null ? <Banner tone="error" failure={notice} /> : null}
      {item ? (
        <>
          <RowCard>
            <RowProp
              label={s.mine.shot}
              value={shot ? `${formatDay(shot)}, ${formatTime(shot)}` : undefined}
              empty={s.mine.none}
              busy={busy === 'shot'}
              onPress={() => setEditing((was) => (was === 'shot' ? null : 'shot'))}
            />
            <RowProp
              label={s.viewer.place}
              value={where}
              empty={s.mine.none}
              busy={busy === 'place'}
              onPress={
                info ? () => setEditing((was) => (was === 'place' ? null : 'place')) : undefined
              }
            />
          </RowCard>

          {editing === 'shot' ? (
            <ShotEditor
              from={shot}
              busy={busy === 'shot'}
              onSave={async (at) => {
                const captured_at = at.toISOString();
                if (!(await change('shot', { captured_at }))) return;
                onEdited({ ...item, captured_at });
                setInfo((was) => was && { ...was, captured_at });
                setEditing(null);
              }}
            />
          ) : null}
          {editing === 'place' && info ? (
            <PlaceEditor
              placed={where !== undefined}
              busy={busy === 'place'}
              onSave={async (point) => {
                if (!(await change('place', point))) return;
                setInfo((was) => was && { ...was, ...point });
                setEditing(null);
              }}
            />
          ) : null}

          <RowCard>
            <RowDo
              icon={EyeOff}
              label={s.mine.hide}
              note={s.mine.hideNote}
              on={item.hidden}
              busy={busy === 'hide'}
              onPress={() => void hide()}
            />
            <RowDo icon={Trash2} label={s.mine.deleteAll} danger onPress={() => onRemove(item)} />
          </RowCard>
        </>
      ) : null}
    </Sheet>
  );
}
function sizeOf(s: ReturnType<typeof useStrings>, bytes: string | undefined): string | null {
  const mb = bytes === undefined ? null : megabytes({ size_bytes: bytes });
  return mb === null ? null : s.viewer.size(mb);
}
function PlaceEditor({
  placed,
  busy,
  onSave,
}: {
  placed: boolean;
  busy: boolean;
  onSave: (point: { latitude: number | null; longitude: number | null }) => void;
}) {
  const s = useStrings();
  const styles = useStyles();
  const [words, setWords] = useState('');
  const [looking, setLooking] = useState(false);
  const [missing, setMissing] = useState(false);
  async function save() {
    if (words.trim() === '') return;
    setLooking(true);
    const point = await findPlace(words.trim());
    setLooking(false);
    setMissing(point === null);
    if (point !== null) onSave(point);
  }
  return (
    <View style={styles.editor}>
      <Field
        label={s.mine.where}
        variant="search"
        icon={MapPin}
        onSurface
        placeholder={s.mine.wherePlaceholder}
        value={words}
        onChangeText={(typed) => {
          setWords(typed);
          setMissing(false);
        }}
        returnKeyType="search"
        onSubmitEditing={() => void save()}
        state={missing ? 'error' : undefined}
        hint={missing ? s.mine.whereMissing : undefined}
      />
      <Button
        variant="primary"
        label={s.action.save}
        busy={busy || looking}
        disabled={words.trim() === ''}
        onPress={() => void save()}
      />
      {placed ? (
        <Button
          variant="quiet"
          wide
          label={s.mine.whereClear}
          disabled={busy || looking}
          onPress={() => onSave({ latitude: null, longitude: null })}
        />
      ) : null}
    </View>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    headWords: { flex: 1, minWidth: 0, gap: 5 },
    thumb: { width: 64, height: 64, borderRadius: radius.strip, backgroundColor: color.raise },
    name: { fontSize: 16, lineHeight: 21 },
    editor: { gap: space.s3 },
  }),
);
