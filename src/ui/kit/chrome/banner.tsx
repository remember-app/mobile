import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { radius, space, useTheme } from '@/ui/theme';
import { Button } from '../controls/button';
import { Text } from '../primitives/text';

export type BannerAction = {
  label: string;
  onPress: () => void;
};

export function NoticeBanner({
  top,
  text,
  actions,
  tone = 'danger',
}: {
  top: number;
  text: string;
  actions?: BannerAction[];
  tone?: 'danger' | 'accent';
}) {
  const { color } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={[styles.wrap, { top }]}
      pointerEvents="box-none"
    >
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.line }]}>
        <Text role="hint" tone={tone}>
          {text}
        </Text>
        {actions && actions.length > 0 ? (
          <View style={styles.actions}>
            {actions.map((action) => (
              <Button
                key={action.label}
                label={action.label}
                variant="quiet"
                wide={false}
                onPress={action.onPress}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.s4,
    right: space.s4,
    zIndex: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.s3,
    gap: space.s2,
    boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.s2,
  },
});
