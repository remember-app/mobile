import { WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { space, useTheme } from '@/ui/theme';

export function NoConnection({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: color.ink }]}>
      <WifiOff size={44} color={color.muted} />
      <Text role="title">{t('connection.title')}</Text>
      <Text role="body" tone="muted" style={styles.text}>
        {t('connection.text')}
      </Text>
      <Button label={t('connection.retry')} wide={false} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s3,
    paddingHorizontal: space.s6,
  },
  text: {
    textAlign: 'center',
  },
});
