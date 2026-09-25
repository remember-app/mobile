import {
  Lock,
  Pencil,
  Tag as TagIcon,
  Trash2,
  TriangleAlert,
  Unlink,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ApiError,
  addLabelMedia,
  createLabel,
  deleteLabel,
  errorMessage,
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
  IconButton,
  type IconComponent,
  Palette,
  RowLabel,
  Sheet,
  Text,
  Waiting,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import {
  filing,
  LABEL_NAME_MAX,
  labelGroups,
  labelNameOk,
  labelTint,
  withLabel,
} from '@/lib/labels';
import { useStrings } from '@/lib/language';
import type { Strings } from '@/strings';
import { height, labelColors, radius, space, themed, useTheme } from '@/theme';

/**
 * The labels of a memory, from picking mode (spec 7.7, `SheetLabels` and `SheetLabelNew`, 10.8.1).
 * A label is a box: a press on a row files everything marked into it, a second press takes it back
 * out, and the frames themselves never move — they stay in the memory, listed once, however many
 * boxes hold them (doc-13).
 *
 * Their own file rather than the feed's: the feed is long enough, and these are a surface over it.
 * `LabelSheets` is the one the screen mounts and the only one that talks to the api; the two under
 * it are handed everything they draw, which is what lets the stories put each of their states on
 * screen without a server.
 *
 * Who may do what is never worked out here. Every label arrives with `can_edit` and `can_add_media`
 * already answered by the api's own rule, and a control is drawn where the server said there may be
 * one — a row the server says may not be filed has no circle at all rather than a circle that
 * refuses.
 */

/** `SheetLabelNew`: shut, making one (`label: null`), or editing the one it holds. */
type Writing = { label: Label | null } | null;

/**
 * A failure as a sheet says it: the words, and the glyph beside them. No glyph is the banner's own
 * «no signal», which only a request that never got an answer has earned.
 */
export type Failure = { text: string; icon?: IconComponent };

/** The statuses a route words itself, because the api's bare «forbidden» or «not found» says nothing. */
type Refusals = Partial<Record<number, Failure>>;

/**
 * Told apart by what came back and never by the words: anything the api answered is not the
 * connection. A 403 is about rights; a 404 is something that is not there, and what that is depends
 * on the route, so every route names its own; anything else the api refused is said in its words
 * beside a plain warning.
 */
function failure(e: unknown, refused: Refusals): Failure {
  if (!(e instanceof ApiError)) return { text: errorMessage(e) };
  return refused[e.status] ?? { text: e.message, icon: e.status === 403 ? Lock : TriangleAlert };
}

/** The api's one answer to somebody not in the memory: about the person, so a tie that is cut. */
const notMember = (s: Strings): Failure => ({ text: s.memory.gone, icon: Unlink });

export function LabelSheets({
  memoryId,
  frames,
  onFiled,
  onClose,
}: {
  memoryId: string;
  /** What is marked on the feed right now, with the boxes each frame already lies in. */
  frames: readonly MediaItem[];
  /**
   * What the api has just done, for the feed to hold on to: which box, which frames, and whether
   * they are in it now. `ids` null is every frame there is — a box that has gone.
   */
  onFiled: (labelId: string, ids: string[] | null, now: boolean) => void;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const s = useStrings();
  const theme = useTheme();
  const [labels, setLabels] = useState<Label[] | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  /** The edit mode of the same sheet (spec 10.8.1) — a mode and not a second sheet. */
  const [editing, setEditing] = useState(false);
  const [writing, setWriting] = useState<Writing>(null);
  const [dropping, setDropping] = useState<Label | null>(null);
  const ids = frames.map((frame) => frame.id);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    listLabels(token, memoryId).then(setLabels, (e: unknown) =>
      setError(failure(e, { 404: notMember(s) })),
    );
  }, [token, memoryId, s]);

  useEffect(load, [load]);

  /**
   * To `SheetLabelNew` and back. A failure stays with the sheet it was said on, and a list that never
   * arrived is read again on the way back rather than left as a wait with no read behind it.
   */
  function write(next: Writing) {
    setWriting(next);
    setError(null);
    if (next === null && labels === null) load();
  }

  /**
   * One errand at the api, with the sheet's own answer to it going wrong. By default a 404 is the
   * label's: somebody deleted it — or, for a private one that was never ours, the api's own way of
   * saying it does not exist (api README, «Кто что может») — so it wears the label's own glyph.
   * Whatever happens, the sheet stops being busy — the one thing it must never do is sit there.
   */
  async function errand<T>(
    run: (session: string) => Promise<T>,
    refused: Refusals = { 404: { text: s.labels.gone, icon: TagIcon } },
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

  /** The whole row is the button: what is marked goes in, or — if it is all in already — comes out. */
  async function file(label: Label) {
    const { inside, ids: moving } = filing(label.id, frames);
    // A second press while the first is still in the air is the same press twice: the rows keep
    // their circles through a request — a circle that vanishes mid-errand reads as the right to
    // file being taken away — so the guard is here rather than in what is drawn.
    if (busy || moving.length === 0) return;
    const answer = await errand((session) =>
      inside
        ? removeLabelMedia(session, memoryId, label.id, moving)
        : addLabelMedia(session, memoryId, label.id, moving),
    );
    if (answer === null) return;
    // The api answers with the row itself, new count and all, so nothing is re-read.
    setLabels((have) => withLabel(have ?? [], answer));
    onFiled(label.id, moving, !inside);
  }

  /** «Новый лейбл»: the box and the frames in it appear together or not at all. */
  async function make(title: string, color: number, shared: boolean) {
    const made = await errand(
      // An empty batch is a 400 and not an empty box: the frames ride along only if there are any.
      (session) =>
        createLabel(session, memoryId, {
          title,
          color,
          shared,
          media_ids: ids.length > 0 ? ids : undefined,
        }),
      // No label in the path, so a 404 is the membership check; a 403 is a viewer asking for «Общий»,
      // and the lock is the private label the words offer instead.
      { 403: { text: s.labels.sharedDenied, icon: Lock }, 404: notMember(s) },
    );
    if (made === null) return;
    setLabels((have) => withLabel(have ?? [], made));
    setWriting(null);
    onFiled(made.id, ids, true);
  }

  /** The same sheet as editing: the name and the colour, and never who sees it (decision-12). */
  async function rename(label: Label, title: string, color: number) {
    const saved = await errand((session) =>
      updateLabel(session, memoryId, label.id, { title, color }),
    );
    if (saved === null) return;
    setLabels((have) => withLabel(have ?? [], saved));
    setWriting(null);
  }

  /** The box goes, the frames stay — so every frame on the feed loses it, not only what is marked. */
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
        // One sheet at a time: a modal raised over a modal is a stack neither platform draws the
        // same way, and the one underneath has nothing to say while it is being written on.
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

      {/* Spec 10.8.1 — the price is deliberately not a number here: nothing is lost but the box. */}
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

/**
 * `SheetLabels` — the list itself: «Общие» and «Мои», and under them the dashed way to a new one.
 * Everything it draws is handed to it, so every state of it is a story: still reading, empty, the
 * two groups, the edit mode, a failure from the server.
 */
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
  /** Null while the one read is still in the air. */
  labels: Label[] | null;
  /** «4 кадра» — what the press is about, written by the screen. */
  count: string;
  /** Whether every marked frame already lies in this label, which is what lights its circle. */
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
              // Spec 10.8.1: in the edit mode the circle gives way to the pair — but only on a
              // label the server lets this person edit. Any other row keeps filing.
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
              // No right to file is no circle and no press: the server decides, and a row that
              // refuses a press would be the dead button the kit refuses everywhere else.
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
      scroll
      rhythm="list"
      head={
        <View style={styles.head}>
          <Text role="sheetTitle" accessibilityRole="header" style={styles.grow}>
            {s.labels.title}
          </Text>
          {/* Spec 10.8.1: the count goes quiet while the sheet is being edited — nothing is being
              filed in that mode. */}
          <Text role="label" tone={editing ? 'muted' : 'paper'}>
            {count}
          </Text>
          {/* The same part as «Править состав» in the settings, and the same switch: the way in
              becomes the way out. Nothing this person may edit is no button at all. */}
          {labels?.some((label) => label.can_edit) ? (
            <Button
              variant={editing ? 'paper' : 'small'}
              size="xs"
              icon={editing ? undefined : Pencil}
              label={editing ? s.action.done : s.labels.edit}
              disabled={busy}
              onPress={onToggleEdit}
            />
          ) : null}
        </View>
      }
      footer={<Button variant="dashed" label={s.labels.newOne} disabled={busy} onPress={onNew} />}
    >
      {error === null ? null : <Banner tone="error" text={error.text} icon={error.icon} />}
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
        // Not a single box yet: both groups are gone and one line says what a label is for. No
        // dashed sign and no heading — the sheet's own title is already up (spec, `SheetLabels`).
        <Text role="body" tone="muted">
          {s.labels.empty}
        </Text>
      )}
    </Sheet>
  );
}

/**
 * `SheetLabelNew` — a name, a colour out of eight, and who sees it. The same sheet edits one
 * (spec 10.8.1): the heading and the button change, the count goes, and **«Кто видит» stops being
 * a question** — it is chosen once, at creation, and changing it afterwards is not allowed
 * (decision-12).
 * Drawn as one read-only card and never as a greyed-out pair: a disabled button promises that one
 * day it will press.
 */
export function LabelNewSheet({
  label,
  count,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  /** The label being edited, or null for a new one. */
  label: Label | null;
  /** How many frames the button is about to file — a new label only. */
  count: number;
  busy: boolean;
  error: Failure | null;
  onSubmit: (title: string, color: number, shared: boolean) => void;
  onCancel: () => void;
}) {
  const s = useStrings();
  const theme = useTheme();
  const styles = useStyles();
  // Seeded once, because this sheet is mounted by being opened.
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
      scroll
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
      {error === null ? null : <Banner tone="error" text={error.text} icon={error.icon} />}

      <Field
        label={s.labels.name}
        variant="labelName"
        onSurface
        // The colour being picked, drawn in front of the name it will stand beside.
        swatch={labelTint(color, theme)}
        value={title}
        onChangeText={setTitle}
        placeholder={s.labels.namePlaceholder}
        maxLength={LABEL_NAME_MAX}
        autoFocus={label === null}
        editable={!busy}
      />

      <View style={styles.group}>
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

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // The title, the count of what is marked and the way into the edit mode, on one line.
    head: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
    grow: { flex: 1, minWidth: 0 },
    // A heading and the block it introduces, as on every other sheet of this memory.
    group: { gap: space.s2 },
    // Spec 7.7: the rows stand in a card the hairlines are drawn inside. On a sheet the card drops
    // to `ink` — the sheet itself is already `surface`.
    card: {
      borderRadius: radius.section,
      overflow: 'hidden',
      backgroundColor: color.ink,
      borderWidth: 1,
      borderColor: color.line,
    },
    // The two 92 tiles of «КТО ВИДИТ», side by side and equal.
    pair: { flexDirection: 'row', gap: space.s2 },
  }),
);
