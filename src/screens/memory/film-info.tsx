import { Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { type Memory, type Montage, memberName } from '@/api';
import { Button, Field, RowCard, RowDo, RowProp, Sheet, Text } from '@/kit';
import { formatDay, formatRuntime } from '@/lib/dates';
import { megabytes } from '@/lib/frames';
import { useStrings } from '@/lib/language';
import { RATIO, trackWords } from '@/lib/montage/order';

/**
 * «2:30 · 16:9» — what the film actually came out as, on its posters and in its sheet. The running
 * time is the worker's own and the shape is what was ordered — the api reads a montage with no
 * orientation on it as horizontal, which is what every montage was before the choice existed.
 */
export const cutAs = (montage: Montage): string =>
  [formatRuntime(montage.duration_seconds), RATIO[montage.params.orientation ?? 'landscape']]
    .filter(Boolean)
    .join(' · ');

/**
 * `SheetFilmInfo` (spec 8) — everything one film has that the next one does not: the template, the
 * music, the frames, the file, who ordered it and who has watched it; and, for the organizer, its
 * name and the film itself to take back. It draws what it is handed and asks nothing — the film's
 * screen reads and writes, so every state of the sheet can be drawn on its own.
 */
export function FilmInfoSheet({
  film,
  memory,
  people,
  taken,
  mayEdit,
  onRename,
  onRemove,
  onClose,
}: {
  film: Montage;
  /** The memory's name and its count of frames, once its listing is read. */
  memory: Pick<Memory, 'title' | 'media_count'> | null;
  /**
   * Everybody in the memory, viewers too, once the roster is read: «Посмотрели» counts out of them.
   * Not `member_count`, which leaves the viewers out while `watched_by` has them in.
   */
  people?: number;
  /** How many frames the director took in — its journal's; not known, the row is not drawn. */
  taken?: number;
  /** The organizer's: the api answers anybody else's rename or delete with 403. */
  mayEdit: boolean;
  onRename: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const s = useStrings();
  const tracks = trackWords(film.params, s);
  const size = megabytes({ size_bytes: film.size_bytes ?? '' });
  const watched = (film.watched_by ?? []).map(memberName);
  const of = (n: number, all: number | undefined) =>
    all === undefined ? String(n) : s.montage.live.doneOf(n, all);

  return (
    <Sheet
      visible
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
        {/* «Настроить самому» is no template, and the row is not there at all (spec 8). */}
        {film.template ? (
          <RowProp
            label={s.montage.film.template}
            value={s.montage.template[film.template]}
            empty={s.mine.none}
          />
        ) : null}
        <RowProp
          label={s.montage.music}
          value={tracks.length > 0 ? s.montage.film.tracks(tracks) : s.montage.film.noMusic}
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

      {/* Not for anybody else, and not greyed out for them either: a door that is not theirs is not
          drawn, the way the pencil on a memory is not. */}
      {mayEdit ? (
        <RowCard>
          <RowDo icon={Pencil} label={s.montage.film.rename} onPress={onRename} />
          <RowDo icon={Trash2} label={s.montage.film.remove} danger onPress={onRemove} />
        </RowCard>
      ) : null}
    </Sheet>
  );
}

/**
 * «Переименовать ролик» (spec 8, `SheetFilmInfo`, `[дописано]`) — one field and one button, the way
 * «Изменить ник» is. Raised from the film's sheet and from the heading of the order's total, and
 * mounted by being opened, so the field always starts from the name as it is.
 *
 * «Сохранить» waits until there is a new name: an empty one is refused here rather than handed to the
 * api, which would read it as «give it back its own» — the spec keeps the name as it was instead.
 */
export function FilmNameSheet({
  name,
  busy,
  error,
  onSave,
  onClose,
}: {
  name: string;
  busy?: boolean;
  /** Why the last try did not go through, under the field. */
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

// Nothing here has a colour of its own: the rows, the field and the words are the kit's.
const styles = StyleSheet.create({
  // Spec 8, `SheetFilmInfo`: the name over the memory's, 4 apart and 2 in from the column.
  head: { gap: 4, paddingHorizontal: 2 },
});
