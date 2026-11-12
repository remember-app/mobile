import { StyleSheet, View } from 'react-native';

import { themed, useTheme } from '@/ui/theme';

export function StepDots({ step, total }: { step: number; total: number }) {
  const { color } = useTheme();
  const styles = useStyles();
  const current = Math.max(0, step - 1);
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: index <= current ? color.accent : color.line,
            },
          ]}
        />
      ))}
    </View>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    dots: {
      flexDirection: 'row',
      gap: 6,
    },
    dot: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },
  }),
);
