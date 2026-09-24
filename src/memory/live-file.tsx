import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { JournalEntry, JournalFile } from '@/api';
import { formatDayShort, formatTime } from '@/dates';
import {
  Avatar,
  BadgeDecision,
  GAZE_SHEET,
  NoteThought,
  Sheet,
  ShotGaze,
  SHOT_SHEET,
  Tag,
  Text,
} from '@/kit';
import { useStrings } from '@/language';
import { gazeAt, marksOf, outcomeLine } from '@/montage-journal';
import { space } from '@/theme';

/**
 * `SheetLiveFile` (spec 7.6) — one file out of the director's journal: the frame with the square
 * where the eye was, whose it is, what was seen on it in words, and the thought that decided it.
 *
 * Its own component and not a piece of the journal screen, because two screens raise it: the montage
 * being watched live, and the same journal read off a finished one months later («Ролик готов»,
 * TASK-222). It is handed the record and the file rather than the montage — nothing on it is about
 * the video as a whole — and the author by name, because who that is comes off the memory's roster
 * and a sheet reads nothing for itself.
 */
export function SheetLiveFile({
  entry,
  file,
  author,
  onCancel,
}: {
  entry: JournalEntry;
  /** Gone from the memory since: the sheet then has the words and no picture (api README). */
  file?: JournalFile;
  /** «Аня Петрова» — off the roster, by `memberName`. */
  author: string;
  onCancel: () => void;
}) {
  const s = useStrings();
  const { width } = useWindowDimensions();
  const [mark] = marksOf(entry, s);
  // The frame runs the width of the sheet inside its own margins, and the sheet itself stops at the
  // 420 `kit/sheet.tsx` holds it to. The gaze arrives as fractions of the picture, so this is what
  // turns them into points of the one actually drawn.
  const gaze = gazeAt(
    entry.focus,
    { width: Math.min(width, SHEET_WIDE) - space.s4 * 2, height: SHOT_SHEET },
    GAZE_SHEET,
  );

  return (
    <Sheet visible onCancel={onCancel} scroll>
      <ShotGaze uri={file?.thumbnail_url ?? undefined} gaze={gaze} />

      <View style={styles.who}>
        <Avatar name={author} size={32} />
        <View style={styles.grow}>
          <Text role="subtitle" numberOfLines={1}>
            {file === undefined ? author : s.media[file.kind]}
          </Text>
          {/* A file that is gone takes this line with it: there is nobody to name and nothing to
              date, and «Someone · » would be a sentence about the hole rather than about the frame. */}
          {file === undefined ? null : (
            <Text role="meta" numberOfLines={1}>
              {file.captured_at
                ? `${author} · ${formatDayShort(file.captured_at)}, ${formatTime(file.captured_at)}`
                : author}
            </Text>
          )}
        </View>
        {/* The decision alone, whatever else qualified it: the qualification is the outcome line
            under the thought, and a sheet that says it twice says it once. */}
        {mark ? (
          <BadgeDecision kind={entry.decision === 'take' ? 'take' : 'pass'} label={mark} />
        ) : null}
      </View>

      {entry.labels && entry.labels.length > 0 ? (
        <View style={styles.seen}>
          <Text role="eyebrow" tone="muted" accessibilityRole="header">
            {s.montage.live.saw.toUpperCase()}
          </Text>
          <View style={styles.tags}>
            {/* By place and not by word: the words are the model's, and nothing stops it from
                saying «смех» twice. */}
            {entry.labels.map((label, at) => (
              <Tag key={at} label={label} />
            ))}
          </View>
        </View>
      ) : null}

      {/* The thought, and under it where the frame went — a frame nobody took has no second line,
          because the plate itself is the explanation (spec 7.6). */}
      {entry.thought ? (
        <NoteThought text={entry.thought} outcome={outcomeLine(entry, file, s)} />
      ) : null}
    </Sheet>
  );
}

/** How wide a sheet is ever drawn — `kit/sheet.tsx`'s own ceiling, needed here to place the gaze. */
const SHEET_WIDE = 420;

// No colour of its own: every piece on this sheet carries the kit's, so the sheet only arranges
// them — which is why this one may be built once instead of per theme.
const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1, minWidth: 0 },
  seen: { gap: space.s2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
