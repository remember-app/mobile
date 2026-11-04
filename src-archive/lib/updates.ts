import * as Updates from 'expo-updates';
import { useEffect } from 'react';
export function useLaunchUpdate() {
  const { isUpdatePending, checkError, downloadError } = Updates.useUpdates();
  const failed = (checkError ?? downloadError)?.message;
  useEffect(() => {
    if (!isUpdatePending) return;
    console.info('update is downloaded, the app restarts into it');
    Updates.reloadAsync().catch((error) =>
      console.warn('update fails to apply now, it runs from the next launch:', error),
    );
  }, [isUpdatePending]);
  useEffect(() => {
    if (failed) console.warn('update does not come down, the app runs the bundle it has:', failed);
  }, [failed]);
}
