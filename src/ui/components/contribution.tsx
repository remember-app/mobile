import { CheckCircle2, CircleDashed, Clock, Ellipsis } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { MockContribution } from '@/ui/mocks/members';
import { useTheme } from '@/ui/theme';

const ICONS = {
  done: CheckCircle2,
  more_coming: Clock,
} as const;

export function Contribution({ contribution }: { contribution: MockContribution }) {
  const { color } = useTheme();

  if (contribution === 'not_started') {
    return (
      <View style={styles.dashed}>
        <CircleDashed size={22} color={color.muted} />
        <View style={styles.middle}>
          <Ellipsis size={12} color={color.muted} />
        </View>
      </View>
    );
  }

  const Icon = ICONS[contribution];
  return <Icon size={22} color={color.muted} />;
}

const styles = StyleSheet.create({
  dashed: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
