import { Image } from 'expo-image';
import { AlertCircle, CheckCircle2, Play } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Button } from '@/ui/kit/button';
import { CircularProgress } from '@/ui/kit/circular-progress';
import { Text } from '@/ui/kit/text';
import { cancelMockUpload, type MockUpload, retryMockUpload } from '@/ui/mocks/uploads';
import { radius, space, themed, useTheme } from '@/ui/theme';

export function UploadSheet({
  projectId,
  upload,
  onClose,
}: {
  projectId: string;
  upload: MockUpload | null;
  onClose: () => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();

  const remove = () => {
    if (!upload) return;
    cancelMockUpload(projectId, upload.id);
    onClose();
  };

  const retry = () => {
    if (!upload) return;
    retryMockUpload(projectId, upload.id);
  };

  return (
    <BottomSheet visible={upload !== null} onClose={onClose}>
      {upload ? (
        <View style={styles.body}>
          <View style={styles.preview}>
            {upload.source ? (
              <Image source={upload.source} style={styles.fill} contentFit="cover" />
            ) : (
              <View style={[styles.fill, styles.video]}>
                <Play size={30} color={color.muted} fill={color.muted} />
              </View>
            )}
          </View>

          <View style={styles.status}>
            {upload.status === 'uploading' ? (
              <CircularProgress value={upload.progress} size={22} stroke={2.5} />
            ) : upload.status === 'failed' ? (
              <AlertCircle size={22} color={color.danger} />
            ) : (
              <CheckCircle2 size={22} color={color.muted} />
            )}
            <Text role="row">
              {upload.status === 'uploading'
                ? 'Загружается'
                : upload.status === 'failed'
                  ? 'Не удалось'
                  : 'Готово'}
            </Text>
          </View>

          {upload.status === 'uploading' ? (
            <Button label="Отменить" variant="secondary" onPress={remove} />
          ) : upload.status === 'failed' ? (
            <View style={styles.actions}>
              <Button label="Повторить" variant="primary" onPress={retry} />
              <Button label="Удалить" variant="quiet" wide={false} onPress={remove} />
            </View>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    body: {
      gap: space.s4,
    },
    preview: {
      height: 220,
      borderRadius: radius.card,
      overflow: 'hidden',
      backgroundColor: color.raise,
    },
    fill: {
      flex: 1,
    },
    video: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    status: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
    },
    actions: {
      gap: space.s2,
    },
  }),
);
