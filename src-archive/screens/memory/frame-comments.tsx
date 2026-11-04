import { ArrowUp, Ellipsis } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ApiError,
  addFrameComment,
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
export function FrameComments({
  memoryId,
  mediaId,
  comments,
  onSent,
  onGone,
}: {
  memoryId: string;
  mediaId: string;
  comments: FrameComment[];
  onSent: (comment: FrameComment) => void;
  onGone: (id: string) => void;
}) {
  const s = useStrings();
  const styles = useStyles();
  const { token } = useAuth();
  const [draft, setDraft] = useState('');
  const [unsent, setUnsent] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [dropping, setDropping] = useState<FrameComment | null>(null);
  const [undropped, setUndropped] = useState<string | null>(null);
  async function send() {
    const body = draft.trim();
    if (body === '' || writing || !token) return;
    setWriting(true);
    try {
      onSent(await addFrameComment(token, memoryId, mediaId, body));
      setDraft('');
      setUnsent(null);
    } catch (failure) {
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
            setUndropped(null);
            setDropping(one);
          }}
        />
      )}

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
function said(failure: unknown): string | undefined {
  return failure instanceof ApiError ? apiReason(failure.body) : undefined;
}
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
      onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
    >
      {comments.map((comment) => (
        <View key={comment.id} style={styles.row}>
          <Avatar name={memberName(comment.author)} size={28} />
          <View style={styles.words}>
            <View style={styles.line}>
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
    head: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
    headName: { flexGrow: 1 },
    none: { marginTop: -4 },
    list: { maxHeight: THREE_ROWS, flexGrow: 0 },
    rows: { gap: space.s3 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    words: { flex: 1, minWidth: 0, gap: 2 },
    line: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
    name: { flexShrink: 1 },
    unsent: { marginTop: -8 },
  }),
);
