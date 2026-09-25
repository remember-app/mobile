import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { JournalEntry, JournalFile } from '@/api';
import {
  Avatar,
  BadgeDecision,
  GAZE_SHEET,
  NoteThought,
  SHOT_SHEET,
  Sheet,
  ShotGaze,
  Tag,
  Text,
} from '@/kit';
import { formatDayShort, formatTime } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import { gazeAt, marksOf, placeLine, whyDecided } from '@/lib/montage/journal';
import { space } from '@/theme';

/**
 * `SheetLiveFile` (spec 7.6) — one file out of the director's journal: the frame with the square
 * where the eye was, whose it is, what was seen on it in words, the thought that decided it, and
 * where it lay in the film.
 *
 * Its own component and not a piece of the journal screen: it is handed the record and the file
 * rather than the montage — nothing on it is about the video as a whole — and the author by name,
 * because who that is comes off the memory's roster and a sheet reads nothing for itself. The
 * journal of a stage raises it, whether the montage is being watched live or was finished months ago.
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
  const why = whyDecided(entry, s);
  const place = placeLine(entry, file, s);
  // The frame runs the width of the sheet inside its own margins, and the sheet itself stops at the
  // 420 `kit/sheet.tsx` holds it to. The gaze arrives as fractions of the picture, so this is what
  // turns them into points of the one actually drawn.
  const gaze = gazeAt(
    entry.focus,
    { width: Math.min(width, SHEET_WIDE) - space.s4 * 2, height: SHOT_SHEET },
    GAZE_SHEET,
  );

  return (
    <Sheet visible onCancel={onCancel} rhythm="list">
      <ShotGaze uri={file?.thumbnail_url ?? undefined} gaze={gaze} />

      <View style={styles.decided}>
        <View style={styles.who}>
          <Avatar name={author} size={32} />
          <View style={styles.grow}>
            <Text role="rowSm" numberOfLines={1}>
              {file === undefined ? author : s.media[file.kind]}
            </Text>
            {/* A file that is gone takes this line with it: there is nobody to name and nothing
                to date, and «Someone · » would be a sentence about the hole rather than about the
                frame. */}
            {file === undefined ? null : (
              <Text role="meta" numberOfLines={1}>
                {file.captured_at
                  ? `${author} · ${formatDayShort(file.captured_at)}, ${formatTime(file.captured_at)}`
                  : author}
              </Text>
            )}
          </View>
          {/* The decision alone, whatever else qualified it: the part of the story is in the place
              line below, and a sheet that says it twice says it once. */}
          {mark ? (
            <BadgeDecision kind={entry.decision === 'take' ? 'take' : 'pass'} label={mark} />
          ) : null}
        </View>
        {/* Why it went that way, where there is a why (spec 28): «Мимо» with the reason it was
            passed over, «Беру» with the organizer's word — each in the colour the journal gives
            what stands beside that decision. Just under it rather than in its row, where a pill
            this long would squeeze the author and the date down to a letter or two. */}
        {why ? (
          <View style={styles.why}>
            <BadgeDecision kind={entry.decision === 'skip' ? 'pass' : 'part'} label={why} />
          </View>
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

      {entry.thought ? <NoteThought text={entry.thought} /> : null}

      {/* Where the frame lay: the layout's, not the thought's, so it stands under the plate or on its
          own where the director said nothing — the whole of the road without it (spec 7.6). */}
      {place ? (
        <Text role="timecode" tone="accent">
          {place}
        </Text>
      ) : null}
    </Sheet>
  );
}

/** How wide a sheet is ever drawn — `kit/sheet.tsx`'s own ceiling, needed here to place the gaze. */
const SHEET_WIDE = 420;

// No colour of its own: every piece on this sheet carries the kit's, so the sheet only arranges
// them — which is why this one may be built once instead of per theme.
const styles = StyleSheet.create({
  decided: { gap: 6 },
  who: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  why: { alignSelf: 'flex-end' },
  // The file and its author keep at least half the row: the decision goes under them on large type
  // rather than squeeze them to a letter (TASK-375).
  grow: { flex: 1, minWidth: '50%' },
  seen: { gap: space.s2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
