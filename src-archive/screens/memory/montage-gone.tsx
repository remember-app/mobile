import { Unlink } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { AppBar, BackButton, Banner, Board } from '@/kit';
import { useStrings } from '@/lib/language';
import { space } from '@/theme';
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
const styles = StyleSheet.create({
  body: { paddingHorizontal: space.s4, paddingTop: space.s3 },
});
