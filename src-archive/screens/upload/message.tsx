import type * as MediaLibrary from 'expo-media-library/legacy';
import { ImageIcon, Smartphone } from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, CardMessage, Empty, Waiting } from '@/kit';
import { useStrings } from '@/lib/language';
import { themed } from '@/theme';
export function NoFeed({
  error,
  access,
  ask,
  reading,
  onRetry,
  top,
}: {
  error: string | null;
  access: MediaLibrary.PermissionResponse | null;
  ask: () => Promise<MediaLibrary.PermissionResponse>;
  reading: boolean;
  onRetry: () => void;
  top: number;
}) {
  const s = useStrings();
  const styles = useStyles();
  if (error !== null) {
    return (
      <CardMessage icon={ImageIcon} text={error} style={{ marginTop: top }}>
        <Button
          variant="primary"
          size="md"
          labelRole="controlMd"
          label={s.action.retry}
          onPress={onRetry}
        />
      </CardMessage>
    );
  }
  if (access === null) {
    return (
      <View style={styles.centre}>
        <Waiting text={s.state.checking} />
      </View>
    );
  }
  if (!access.granted) {
    return (
      <CardMessage
        icon={ImageIcon}
        text={access.canAskAgain ? s.upload.explain : s.upload.refused}
        style={{ marginTop: top }}
      >
        <Button
          variant="primary"
          size="md"
          labelRole="controlMd"
          label={access.canAskAgain ? s.upload.allow : s.action.openSettings}
          onPress={() => void (access.canAskAgain ? ask() : Linking.openSettings())}
        />
      </CardMessage>
    );
  }
  if (reading) {
    return (
      <View style={styles.centre}>
        <Waiting text={s.upload.reading} />
      </View>
    );
  }
  return (
    <View style={styles.middle}>
      <Empty
        sign="dashed"
        icon={Smartphone}
        title={s.upload.emptyTitle}
        text={s.upload.emptyText}
      />
    </View>
  );
}
const useStyles = themed(() =>
  StyleSheet.create({
    centre: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
    middle: { flexGrow: 1, justifyContent: 'center' },
  }),
);
