import { Unlink } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { AppBar, BackButton, Banner, Board } from '@/kit';
import { useStrings } from '@/lib/language';
import { space } from '@/theme';

/**
 * A screen of a montage the api answers 404 about (spec 8, `MontageLive` and `MontageLiveStage`):
 * the reader is not in the memory, or no longer. Nothing of the montage is drawn — no journal, no
 * poster, no button that could only be refused — only the bar with its way back and the one line
 * every screen of a memory says it with, under the glyph of a tie that is cut and not of a signal
 * that is lost: this is not a connection that will come back.
 */
export function MontageGone({ title, onBack }: { title: string; onBack: () => void }) {
  const s = useStrings();
  return (
    <Board
      bar={
        <AppBar
          variant="live"
          title={title}
          left={<BackButton label={s.action.back} onPress={onBack} />}
        />
      }
      body={styles.body}
    >
      <Banner tone="error" icon={Unlink} text={s.memory.gone} />
    </Board>
  );
}

// 12 under the bar, where the body of every screen of a montage starts.
const styles = StyleSheet.create({
  body: { paddingHorizontal: space.s4, paddingTop: space.s3 },
});
