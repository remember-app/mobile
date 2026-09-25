import type * as MediaLibrary from 'expo-media-library/legacy';
import { ImageIcon, Smartphone } from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, CardMessage, Empty, Waiting } from '@/kit';
import { useStrings } from '@/lib/language';
import { board, themed } from '@/theme';

/**
 * The body of the upload screen with no feed on it, in the four states the layout draws it in: a
 * gallery that would not open, the phone not having answered yet, the grant not given, and the roll
 * still arriving — and an empty roll under all of them.
 */
export function NoFeed({
  error,
  access,
  ask,
  reading,
  onRetry,
}: {
  error: string | null;
  access: MediaLibrary.PermissionResponse | null;
  ask: () => Promise<MediaLibrary.PermissionResponse>;
  reading: boolean;
  onRetry: () => void;
}) {
  const s = useStrings();
  const styles = useStyles();

  // Nothing to put on the screen at all. The message stands in the flow and carries what can be
  // done about it, the same shape `UploadAccess` uses — this one can only be tried again.
  if (error !== null) {
    return (
      <CardMessage icon={ImageIcon} text={error} style={styles.message}>
        <Button variant="primary" size="md" label={s.action.retry} onPress={onRetry} />
      </CardMessage>
    );
  }

  // The phone has not said yet whether we may look.
  if (access === null) {
    return (
      <View style={styles.centre}>
        <Waiting text={s.state.checking} />
      </View>
    );
  }

  // `UploadAccess`: the phone's own dialog while it is still worth asking, and Settings once the
  // phone has stopped asking.
  if (!access.granted) {
    return (
      <CardMessage
        icon={ImageIcon}
        text={access.canAskAgain ? s.upload.explain : s.upload.refused}
        style={styles.message}
      >
        <Button
          variant="primary"
          size="md"
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

  // `UploadEmpty` — access given and nothing to give back. No bottom layer under it: there is
  // nothing to offer. In the middle of the body down to the screen's edge (124 to 844), like the
  // waits above, and not pinned under the bar.
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
    // The message card stands lower than the body under the bar (`UploadAccess`: 132, not 124).
    message: { marginTop: board.bodyUploadCard - board.bodyUpload },
  }),
);
