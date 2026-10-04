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

/** A frame of one's own, as «Мои кадры» holds it: in the memory, or still on its way up. */
export type Own =
  | { key: string; at: number; item: MediaItem; file?: undefined }
  | { key: string; at: number; file: QueuedFile; item?: undefined };

/** What the sheet is changing right now — one thing at a time. */
type Busy = 'shot' | 'place' | 'hide';

/**
 * `SheetMyFrame` (spec 8) — one's own frame: what the file is, and what its owner may change — when
 * it was shot and where, whether it stands in the shared feed, and whether it is in the memory at
 * all. «Снято» and «Место» open in place under their card; nothing here leads to a screen of its
 * own. Mounted by being opened, so each frame starts on a clean sheet.
 *
 * A frame still on its way up, or stuck on it, is not in the memory yet: there is nothing to date,
 * place or hide, and the sheet says what the file is and what became of it, and no more.
 */
export function FrameSheet({
  memoryId,
  own,
  onEdited,
  onRemove,
  onClose,
}: {
  memoryId: string;
  own: Own;
  /** The record as it now stands, once the api has taken a change to it. */
  onEdited: (item: MediaItem) => void;
  /** «Удалить у всех» — the screen asks first, on the sheet that names the price. */
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

  // The file's name and its place are not in the listing; the frame's own read has them.
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

  /** One change sent, and what it did to the record handed back — `false` when the api said no. */
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

  /** Spec 8: hidden at once and the sheet goes, the sign on the tile says the rest — nothing to ask. */
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
  // «4,1 МБ · 4032 × 3024» for a frame that is in; for one still on its way, what became of it.
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
            {/* The file's own name is cut, not wrapped: it has no spaces to wrap at (spec 3). */}
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
              // The place is only known once the frame's own read is in.
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

/** «4,1 МБ» — or nothing, for a size that did not come. */
function sizeOf(s: ReturnType<typeof useStrings>, bytes: string | undefined): string | null {
  const mb = bytes === undefined ? null : megabytes({ size_bytes: bytes });
  return mb === null ? null : s.viewer.size(mb);
}

/**
 * «Место», opened in place: a place typed in words and found by the phone's own geocoder, or the
 * place taken off.
 */
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
    // Spec 8, `SheetMyFrame`: the 64 thumbnail and two floors 5 apart, 14 between them.
    head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    headWords: { flex: 1, minWidth: 0, gap: 5 },
    thumb: { width: 64, height: 64, borderRadius: radius.strip, backgroundColor: color.raise },
    name: { fontSize: 16, lineHeight: 21 },
    editor: { gap: space.s3 },
  }),
);
