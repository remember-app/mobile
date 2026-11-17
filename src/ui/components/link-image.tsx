import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { isImageLink, readText, uploadImageFromLink } from '@/functionality';
import type { MediaId } from '@/types/id';
import { Text } from '@/ui/kit/text';
import { radius, space, themed } from '@/ui/theme';

export function useLinkImage(onMedia: (mediaId: MediaId, uri: string) => void) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const paste = async () => {
    setFailed(null);
    const text = (await readText()).trim();
    if (!isImageLink(text)) {
      setFailed(text);
      return;
    }
    setBusy(true);
    try {
      const { mediaId, uri } = await uploadImageFromLink(text);
      onMedia(mediaId, uri);
    } catch {
      setFailed(text);
    } finally {
      setBusy(false);
    }
  };

  return { busy, failed, paste, clear: () => setFailed(null) };
}

export function LinkBanner({ link }: { link: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <Animated.View entering={FadeInDown.duration(180)} style={styles.banner}>
      <Text role="hint" tone="danger">
        {t('linkImage.hint')}
      </Text>
      <Text role="hint" tone="danger">
        {t('linkImage.failed')}
      </Text>
      <Text role="meta" tone="muted" numberOfLines={1} ellipsizeMode="middle">
        {link || '—'}
      </Text>
    </Animated.View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    banner: {
      gap: space.s1,
      padding: space.s3,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
  }),
);
