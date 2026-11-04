import { Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { type Memory, type Montage, memberName } from '@/api';
import { Button, Field, RowCard, RowDo, RowProp, Sheet, Text } from '@/kit';
import { formatDay, formatRuntime } from '@/lib/dates';
import { megabytes } from '@/lib/frames';
import { useStrings } from '@/lib/language';
import { RATIO, trackWords } from '@/lib/montage/order';
export const cutAs = (montage: Montage): string =>
  [formatRuntime(montage.duration_seconds), RATIO[montage.params.orientation ?? 'landscape']]
    .filter(Boolean)
    .join(' · ');
export function FilmInfoSheet({
  visible = true,
  film,
  memory,
  people,
  taken,
  mayEdit,
  onRename,
  onRemove,
  onClose,
}: {
  visible?: boolean;
  film: Montage;
  memory: Pick<Memory, 'title' | 'media_count'> | null;
  people?: number;
  taken?: number;
  mayEdit: boolean;
  onRename: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const s = useStrings();
  const tracks = trackWords(film.params, s);
  const director = film.params.music_director === true;
  const size = megabytes({ size_bytes: film.size_bytes ?? '' });
  const watched = (film.watched_by ?? []).map(memberName);
  const of = (n: number, all: number | undefined) =>
    all === undefined ? String(n) : s.montage.live.doneOf(n, all);
  return (
    <Sheet
      visible={visible}
      onCancel={onClose}
      rhythm="list"
      head={
        <View style={styles.head}>
          <Text role="sheetTitleSm" accessibilityRole="header">
            {film.name}
          </Text>
          {memory ? <Text role="note">{memory.title}</Text> : null}
        </View>
      }
    >
      <RowCard>
        {film.template ? (
          <RowProp
            label={s.montage.film.template}
            value={s.montage.template[film.template]}
            empty={s.mine.none}
          />
        ) : null}
        <RowProp
          label={s.montage.music}
          value={
            director
              ? s.montage.directorChoice
              : tracks.length > 0
                ? s.montage.film.tracks(tracks)
                : s.montage.film.noMusic
          }
          empty={s.mine.none}
        />
        {taken === undefined ? null : (
          <RowProp
            label={s.memory.framesPlain}
            value={of(taken, memory?.media_count)}
            empty={s.mine.none}
          />
        )}
        <RowProp
          label={s.viewer.file}
          value={[cutAs(film), size === null ? null : s.viewer.size(size)]
            .filter(Boolean)
            .join(' · ')}
          empty={s.mine.none}
        />
        <RowProp
          label={s.montage.film.made}
          value={`${formatDay(film.created_at)} · ${memberName(film.ordered_by)}`}
          empty={s.mine.none}
        />
        <RowProp
          label={s.montage.film.watchedBy}
          value={of(watched.length, people)}
          empty={s.mine.none}
          faces={watched}
        />
      </RowCard>

      {mayEdit ? (
        <RowCard>
          <RowDo icon={Pencil} label={s.montage.film.rename} onPress={onRename} />
          <RowDo icon={Trash2} label={s.montage.film.remove} danger onPress={onRemove} />
        </RowCard>
      ) : null}
    </Sheet>
  );
}
export function FilmNameSheet({
  name,
  busy,
  error,
  onSave,
  onClose,
}: {
  name: string;
  busy?: boolean;
  error?: string | null;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const s = useStrings();
  const [typed, setTyped] = useState(name);
  const next = typed.trim();
  const ready = next !== '' && next !== name;
  const save = () => {
    if (ready && !busy) onSave(next);
  };
  return (
    <Sheet
      visible
      onCancel={busy ? () => {} : onClose}
      title={s.montage.film.nameTitle}
      footer={
        <Button
          variant="primary"
          label={s.action.save}
          busy={busy}
          disabled={!ready}
          onPress={save}
        />
      }
    >
      <Field
        label={s.create.titleLabel}
        variant="name"
        onSurface
        value={typed}
        onChangeText={setTyped}
        editable={!busy}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
        state={error ? 'error' : undefined}
        hint={error ?? undefined}
      />
    </Sheet>
  );
}
const styles = StyleSheet.create({
  head: { gap: 4, paddingHorizontal: 2 },
});
