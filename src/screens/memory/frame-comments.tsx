import { ArrowUp, Ellipsis } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  addFrameComment,
  ApiError,
  apiReason,
  deleteFrameComment,
  type FrameComment,
  memberName,
} from '@/api';
import { Avatar, ConfirmSheet, Field, IconButton, Text } from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatAgo } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import { height, space, themed } from '@/theme';

/**
 * «Комментарии» — what people wrote under this frame (`FrameInfo.html` lines 33–49), the third
 * block the panel draws after the labels and the person.
 *
 * **A line the server knows nothing about is not drawn**, and here that rule has a second edge: an
 * empty list is a *list*, not a missing field. The api answers `[]` for a frame nobody has written
 * about, and the block says so under a counter of zero — an empty pill with no line in it would be
 * a different answer. What draws no block at all is an api that sends no `comments` field, which is
 * what the panel's own rule says to do with it.
 *
 * The list is the api's order — oldest first — and a new one joins at the end of it, which is the
 * end of the scroll. The api hands back the row it wrote, in the very form the read would have
 * given, so nothing is asked a second time (TASK-497).
 *
 * Whether the sign stands on a comment is the api's word and never the app's: `mine` came down
 * with the row, the same way `Label.can_edit` does, and somebody else's comment is removed by
 * nobody — the organizer included. The rule is not written out here twice to be right twice.
 */
export function FrameComments({
  memoryId,
  mediaId,
  comments,
  onSent,
  onGone,
}: {
  memoryId: string;
  mediaId: string;
  /** The api's own order, and only while the panel is standing over it. */
  comments: FrameComment[];
  /** The row the api wrote, in the form the read would have given — the list grows by it. */
  onSent: (comment: FrameComment) => void;
  onGone: (id: string) => void;
}) {
  const s = useStrings();
  const styles = useStyles();
  const { token } = useAuth();
  const [draft, setDraft] = useState('');
  /**
   * The words are still in the field and the api would not take them: the field wears the red, and
   * this is what stands under it — the api's own sentence where it sent one, and otherwise nothing
   * but the fact that it did not go. A phone cannot tell a dead connection from a comment over the
   * server's ceiling, and a line naming either sends the person hunting a signal that is not the
   * reason (TASK-506).
   */
  const [unsent, setUnsent] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [dropping, setDropping] = useState<FrameComment | null>(null);
  /** And the same, said over the comment the api would not take down. */
  const [undropped, setUndropped] = useState<string | null>(null);

  /** The write either lands in the list or does not; an errand already in the air is not repeated. */
  async function send() {
    const body = draft.trim();
    if (body === '' || writing || !token) return;
    setWriting(true);
    try {
      onSent(await addFrameComment(token, memoryId, mediaId, body));
      setDraft('');
      setUnsent(null);
    } catch (failure) {
      // The words stay where they were typed, and pressing again sends them again — the api was
      // never asked to remember a draft, and the person is the one holding it.
      setUnsent(said(failure) ?? s.viewer.commentNotSent);
    } finally {
      setWriting(false);
    }
  }

  async function drop() {
    const one = dropping;
    if (one === null || writing || !token) return;
    setWriting(true);
    try {
      await deleteFrameComment(token, memoryId, mediaId, one.id);
      onGone(one.id);
      setDropping(null);
      setUndropped(null);
    } catch (failure) {
      // The api refused, so the comment is still there and the sheet stays up over it: an errand
      // that did not happen changes nothing on screen — unless it says so.
      setUndropped(said(failure) ?? s.viewer.commentNotRemoved);
    } finally {
      setWriting(false);
    }
  }

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text role="meta" tone="muted" accessibilityRole="header" style={styles.headName}>
          {s.viewer.comments}
        </Text>
        {/* The whole number, never a count of what fits: three rows stand and the fourth says 4.
            `muted` and not the grey the drawing uses — spec 10.1 reads every one of these as
            secondary text that is *read*, and `faint` sits under the floor of contrast. */}
        <Text role="meta">{String(comments.length)}</Text>
      </View>

      {comments.length === 0 ? (
        <Text role="meta" style={styles.none}>
          {s.viewer.commentsNone}
        </Text>
      ) : (
        <CommentList
          comments={comments}
          onDrop={(one) => {
            // A refusal is about the comment it happened over; the next sheet asks about another one
            // and must not open carrying the last one's words.
            setUndropped(null);
            setDropping(one);
          }}
        />
      )}

      {/* The pill, and the round button that stands in it only once there is something to send. */}
      <Field
        label={s.viewer.commentPlaceholder}
        labelHidden
        variant="comment"
        value={draft}
        onChangeText={(next) => {
          setDraft(next);
          setUnsent(null);
        }}
        placeholder={s.viewer.commentPlaceholder}
        multiline
        state={unsent ? 'error' : undefined}
        editable={!writing}
        trailing={
          draft.trim() === '' ? undefined : (
            <IconButton
              icon={ArrowUp}
              label={s.action.send}
              size={height.roundRow}
              tone="paper"
              disabled={writing}
              onPress={() => void send()}
            />
          )
        }
      />
      {/* What went wrong is under its own field and not in the panel's banner: the rest of the
          frame is still true, and this one thing is not. */}
      {unsent ? (
        <Text role="hint" style={styles.unsent}>
          {unsent}
        </Text>
      ) : null}

      <ConfirmSheet
        visible={dropping !== null}
        title={s.viewer.commentDeleteAsk}
        text={s.viewer.commentDeleteText}
        confirmLabel={s.action.delete}
        cancelLabel={s.gallery.keep}
        busy={writing}
        error={undropped ?? undefined}
        onConfirm={() => void drop()}
        onCancel={() => {
          setDropping(null);
          setUndropped(null);
        }}
      />
    </View>
  );
}

/**
 * What the api said about a refusal, and nothing else — `undefined` where it said nothing, which is
 * the whole reason this is not `errorMessage`: that one says «Cannot reach the API» for anything
 * that was not an `ApiError`, and it is already a guess — a request can fail because the phone
 * slept, not because the wire is down. This screen has two refusals and one line each, so the line
 * is the api's own sentence or it is nothing (TASK-506).
 */
function said(failure: unknown): string | undefined {
  return failure instanceof ApiError ? apiReason(failure.body) : undefined;
}

/**
 * The rows, scrolling inside the block rather than pushing the panel's own blocks down: three of
 * them stand without a scroll and everything past that is reached inside this one, so a frame with
 * thirty comments under it has not pushed the file's own lines off the screen.
 *
 * The floor is three rows of one line each — the name 16 and the body 18 under it, with 2 between
 * (`FrameInfo` lines 42–43) — and the block's own 12 between rows. A comment of two lines grows the
 * list past this and scrolls with it, which is the point: the number under the heading is the
 * number there is, whatever of it is in sight.
 *
 * ponytail: 36 is the row height written out, because it is the row height of *this* row — the
 * name's line plus the body's. A row that grows with the system's type grows the list with it and
 * scrolls, which is what a floor is for; the number stops being an estimate when the row does.
 */
const THREE_ROWS = 3 * 36 + 2 * space.s3;

function CommentList({
  comments,
  onDrop,
}: {
  comments: FrameComment[];
  onDrop: (comment: FrameComment) => void;
}) {
  const s = useStrings();
  const styles = useStyles();
  const list = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={list}
      style={styles.list}
      contentContainerStyle={styles.rows}
      showsVerticalScrollIndicator={false}
      // A comment just written stands at the end of the api's order, which is the end of the list,
      // and a person who cannot see the line they just wrote has not been told anything.
      onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
    >
      {comments.map((comment) => (
        <View key={comment.id} style={styles.row}>
          <Avatar name={memberName(comment.author)} size={28} />
          <View style={styles.words}>
            <View style={styles.line}>
              {/* A comment of their own is the same row with «вы» where the name stands, and
                  nothing else about it is different. */}
              <Text role="label" style={styles.name}>
                {comment.mine ? s.viewer.commentMine : memberName(comment.author)}
              </Text>
              <Text role="metaSm">
                {formatAgo(comment.created_at, {
                  yesterday: s.viewer.agoYesterday,
                  beforeYesterday: s.viewer.agoBeforeYesterday,
                })}
              </Text>
            </View>
            <Text role="log" tone="quote">
              {comment.body}
            </Text>
          </View>
          {/* The three dots the frame's own bar drops — on this comment only where the api said
              `mine`, so the sign is drawn where taking it down is allowed and nowhere else. */}
          {comment.mine ? (
            <IconButton
              icon={Ellipsis}
              label={s.viewer.commentRemove}
              size={height.roundTiny}
              onPress={() => onDrop(comment)}
            />
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    block: { gap: space.s3 },
    // «Комментарии» and its counter on one line, the counter right and never given away.
    head: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
    headName: { flexGrow: 1 },
    none: { marginTop: -4 },
    // Three rows and no more, then it scrolls inside itself.
    list: { maxHeight: THREE_ROWS, flexGrow: 0 },
    // The block's own 12 between rows (`FrameInfo.html` line 37), the same one the header and the
    // pill stand 12 apart by.
    rows: { gap: space.s3 },
    // `FrameInfo.html` line 40: the face 28, 10 from the words, which take the rest. No padding of
    // its own — the 12 between rows is the block's, and a row that padded itself would make
    // {@link THREE_ROWS} a number about something else.
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    words: { flex: 1, minWidth: 0, gap: 2 },
    // The name and when it was written, the one on the baseline of the other (line 42).
    line: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
    name: { flexShrink: 1 },
    unsent: { marginTop: -8 },
  }),
);
