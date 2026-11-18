import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/ui/kit/controls/button';
import { Text } from '@/ui/kit/primitives/text';
import { space } from '@/ui/theme';

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <Text role="body" tone="muted" style={styles.text}>
        {t('common.loadFailed')}
      </Text>
      <Button label={t('action.retry')} wide={false} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: space.s6,
    paddingHorizontal: space.s5,
  },
  text: { textAlign: 'center' },
});
