import { Lock, Pencil, Plus, Tag as TagIcon, Trash2, Users } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  addLabelMedia,
  createLabel,
  deleteLabel,
  type Label,
  listLabels,
  type MediaItem,
  removeLabelMedia,
  updateLabel,
} from '@/api';
import {
  Banner,
  Button,
  ChoiceCard,
  ConfirmSheet,
  Field,
  Hint,
  hitSlop,
  IconButton,
  Palette,
  RowLabel,
  Sheet,
  Text,
  Waiting,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { type Failure, failure, notMember, type Refusals, saying } from '@/lib/failure';
import {
  filing,
  LABEL_NAME_MAX,
  labelGroups,
  labelNameOk,
  labelTint,
  withLabel,
} from '@/lib/labels';
import { useStrings } from '@/lib/language';
import { height, labelColors, radius, space, themed, useTheme } from '@/theme';

type Writing = {
  label: Label | null;
} | null;
export function LabelSheets({
  memoryId,
  frames,
  onFiled,
  onClose,
}: {
  memoryId: string;
  frames: readonly MediaItem[];
  onFiled: (labelId: string, ids: string[] | null, now: boolean) => void;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const s = useStrings();
  const theme = useTheme();
  const [labels, setLabels] = useState<Label[] | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [writing, setWriting] = useState<Writing>(null);
  const [dropping, setDropping] = useState<Label | null>(null);
  const ids = frames.map((frame) => frame.id);
  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    listLabels(token, memoryId).then(setLabels, (e: unknown) => setError(failure(e, notMember(s))));
  }, [token, memoryId, s]);
  useEffect(load, [load]);
  function write(next: Writing) {
    setWriting(next);
    setError(null);
    if (next === null && labels === null) load();
  }
  async function errand<T>(
    run: (session: string) => Promise<T>,
    refused: Refusals = { 404: { text: saying(s.labels.gone), icon: TagIcon } },
  ): Promise<T | null> {
    if (!token) return null;
    setBusy(true);
    setError(null);
    try {
      return await run(token);
    } catch (e) {
      setError(failure(e, refused));
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function file(label: Label) {
    const { inside, ids: moving } = filing(label.id, frames);
    if (busy || moving.length === 0) return;
    const answer = await errand((session) =>
      inside
        ? removeLabelMedia(session, memoryId, label.id, moving)
        : addLabelMedia(session, memoryId, label.id, moving),
    );
    if (answer === null) return;
    setLabels((have) => withLabel(have ?? [], answer));
    onFiled(label.id, moving, !inside);
  }
  async function make(title: string, color: number, shared: boolean) {
    const made = await errand(
      (session) =>
        createLabel(session, memoryId, {
          title,
          color,
          shared,
          media_ids: ids.length > 0 ? ids : undefined,
        }),
      { 403: { text: saying(s.labels.sharedDenied), icon: Lock }, ...notMember(s) },
    );
    if (made === null) return;
    setLabels((have) => withLabel(have ?? [], made));
    setWriting(null);
    onFiled(made.id, ids, true);
  }
  async function rename(label: Label, title: string, color: number) {
    const saved = await errand((session) =>
      updateLabel(session, memoryId, label.id, { title, color }),
    );
    if (saved === null) return;
    setLabels((have) => withLabel(have ?? [], saved));
    setWriting(null);
  }
  async function drop(label: Label) {
    setDropping(null);
    const gone = await errand((session) => deleteLabel(session, memoryId, label.id));
    if (gone === null) return;
    setLabels((have) => (have ?? []).filter((one) => one.id !== label.id));
    onFiled(label.id, null, false);
  }
  return (
    <>
      <LabelsSheet
        visible={writing === null && dropping === null}
        labels={labels}
        count={s.memory.frames(frames.length)}
        inside={(labelId) => filing(labelId, frames).inside}
        editing={editing}
        busy={busy}
        error={error}
        onToggleEdit={() => setEditing((was) => !was)}
        onFile={(label) => void file(label)}
        onNew={() => write({ label: null })}
        onRename={(label) => write({ label })}
        onDelete={setDropping}
        onClose={onClose}
      />

      {writing === null ? null : (
        <LabelNewSheet
          label={writing.label}
          count={frames.length}
          busy={busy}
          error={error}
          onSubmit={(title, color, shared) =>
            void (writing.label ? rename(writing.label, title, color) : make(title, color, shared))
          }
          onCancel={() => write(null)}
        />
      )}

      <ConfirmSheet
        visible={dropping !== null}
        tint={dropping ? labelTint(dropping.color, theme) : undefined}
        title={s.labels.deleteAsk(dropping?.title ?? '')}
        text={s.labels.deleteText}
        confirmLabel={s.labels.deleteConfirm}
        cancelLabel={s.gallery.keep}
        onConfirm={() => {
          if (dropping) void drop(dropping);
        }}
        onCancel={() => setDropping(null)}
      />
    </>
  );
}
export function LabelsSheet({
  visible,
  labels,
  count,
  inside,
  editing,
  busy,
  error,
  onToggleEdit,
  onFile,
  onNew,
  onRename,
  onDelete,
  onClose,
}: {
  visible: boolean;
  labels: Label[] | null;
  count: string;
  inside: (labelId: string) => boolean;
  editing: boolean;
  busy: boolean;
  error: Failure | null;
  onToggleEdit: () => void;
  onFile: (label: Label) => void;
  onNew: () => void;
  onRename: (label: Label) => void;
  onDelete: (label: Label) => void;
  onClose: () => void;
}) {
  const s = useStrings();
  const theme = useTheme();
  const styles = useStyles();
  const { shared, own } = labelGroups(labels ?? []);
  const block = (heading: string, group: Label[]) =>
    group.length === 0 ? null : (
      <View style={styles.group}>
        <Text role="eyebrow" tone="muted" accessibilityRole="header">
          {heading.toUpperCase()}
        </Text>
        <View style={styles.card}>
          {group.map((label, at) => (
            <RowLabel
              key={label.id}
              tint={labelTint(label.color, theme)}
              name={label.title}
              count={s.memory.frames(label.media_count)}
              scope={label.shared ? 'shared' : 'own'}
              scopeLabel={label.shared ? s.labels.seenByAll : s.labels.seenByYou}
              inside={inside(label.id)}
              divider={at > 0}
              actions={
                editing && label.can_edit ? (
                  <>
                    <IconButton
                      size={height.roundRow}
                      icon={Pencil}
                      label={s.labels.rename(label.title)}
                      disabled={busy}
                      onPress={() => onRename(label)}
                    />
                    <IconButton
                      size={height.roundRow}
                      icon={Trash2}
                      tone="danger"
                      label={s.labels.remove(label.title)}
                      disabled={busy}
                      onPress={() => onDelete(label)}
                    />
                  </>
                ) : undefined
              }
              onPress={label.can_add_media ? () => onFile(label) : undefined}
            />
          ))}
        </View>
      </View>
    );
  return (
    <Sheet
      visible={visible}
      onCancel={onClose}
      rhythm="list"
      head={
        <View style={styles.head}>
          <Text role="sheetTitle" accessibilityRole="header" style={styles.title}>
            {s.labels.title}
          </Text>

          <Text role="label" tone="muted">
            {count}
          </Text>

          {labels?.some((label) => label.can_edit) ? (
            <Button
              variant={editing ? 'paper' : 'small'}
              size="mini"
              wide={false}
              icon={editing ? undefined : Pencil}
              label={editing ? s.action.done : s.labels.edit}
              disabled={busy}
              onPress={onToggleEdit}
            />
          ) : null}
        </View>
      }
      footer={
        <Button
          variant="dashed"
          icon={Plus}
          label={s.labels.newOne}
          disabled={busy}
          onPress={onNew}
        />
      }
    >
      {error === null ? null : <Banner tone="error" failure={error} />}
      {labels === null ? (
        error === null ? (
          <Waiting text={s.state.loading} />
        ) : null
      ) : labels.length > 0 ? (
        <>
          {block(s.labels.shared, shared)}
          {block(s.labels.own, own)}
        </>
      ) : (
        <Text role="body" tone="muted">
          {s.labels.empty}
        </Text>
      )}
    </Sheet>
  );
}
export function LabelNewSheet({
  label,
  count,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  label: Label | null;
  count: number;
  busy: boolean;
  error: Failure | null;
  onSubmit: (title: string, color: number, shared: boolean) => void;
  onCancel: () => void;
}) {
  const s = useStrings();
  const theme = useTheme();
  const styles = useStyles();
  const [title, setTitle] = useState(label?.title ?? '');
  const [color, setColor] = useState(label?.color ?? 1);
  const [shared, setShared] = useState(label?.shared ?? true);
  const palette = labelColors(theme);
  const ready = labelNameOk(title) && !busy;
  return (
    <Sheet
      visible
      onCancel={onCancel}
      title={label ? s.labels.editTitle : s.labels.newOne}
      footer={
        <Button
          variant="primary"
          label={label ? s.labels.save : s.labels.create(count)}
          busy={busy}
          disabled={!ready}
          onPress={() => onSubmit(title.trim(), color, shared)}
        />
      }
    >
      {error === null ? null : <Banner tone="error" failure={error} />}

      <Field
        label={s.labels.name}
        variant="labelName"
        onSurface
        swatch={labelTint(color, theme)}
        value={title}
        onChangeText={setTitle}
        placeholder={s.labels.namePlaceholder}
        maxLength={LABEL_NAME_MAX}
        autoFocus={label === null}
        editable={!busy}
      />

      <View style={[styles.group, styles.colours]}>
        <Text role="eyebrow" tone="muted" accessibilityRole="header">
          {s.labels.colour.toUpperCase()}
        </Text>
        <Palette
          colors={palette}
          names={s.labels.colours}
          label={s.labels.colourLabel}
          value={labelTint(color, theme)}
          onChange={(picked) => setColor(palette.indexOf(picked) + 1)}
        />
      </View>

      <View style={styles.group}>
        <Text role="eyebrow" tone="muted" accessibilityRole="header">
          {s.labels.who.toUpperCase()}
        </Text>
        {label ? (
          <>
            <ChoiceCard
              icon={label.shared ? Users : Lock}
              title={label.shared ? s.labels.sharedCard : s.labels.ownCard}
              note={label.shared ? s.labels.sharedNote : s.labels.ownNote}
              variant="row"
              readOnly
            />
            <Hint>{s.labels.whoFixed}</Hint>
          </>
        ) : (
          <View style={styles.pair}>
            <ChoiceCard
              icon={Users}
              title={s.labels.sharedCard}
              note={s.labels.sharedNote}
              selected={shared}
              onPress={() => setShared(true)}
            />
            <ChoiceCard
              icon={Lock}
              title={s.labels.ownCard}
              note={s.labels.ownNote}
              selected={!shared}
              onPress={() => setShared(false)}
            />
          </View>
        )}
      </View>
    </Sheet>
  );
}
const PALETTE_AIR = hitSlop(36).top;
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s2 },
    title: { flexGrow: 1 },
    group: { gap: space.s2 },
    colours: { gap: 10 - PALETTE_AIR, marginBottom: -PALETTE_AIR },
    card: {
      borderRadius: radius.section,
      overflow: 'hidden',
      backgroundColor: color.ink,
      borderWidth: 1,
      borderColor: color.line,
    },
    pair: { flexDirection: 'row', gap: space.s2 },
  }),
);
