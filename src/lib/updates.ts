import * as Updates from 'expo-updates';
import { useEffect } from 'react';

/**
 * An update published to the build's channel, taken on the launch it is found on and not the one
 * after. expo-updates itself asks the server on every cold launch and fetches what is new in the
 * background, but runs it only from the next cold launch on — and an iPhone keeps an app suspended
 * for days, so a fix would sit on the phone unseen. Here the app restarts into it the moment it is
 * down: at launch nothing is half-done yet, and an upload the restart cuts short is picked up from
 * its queue on disk (`@/lib/upload/send`).
 *
 * A no-op wherever updates are off — Expo Go, a dev build on Metro, tests.
 */
export function useLaunchUpdate() {
  const { isUpdatePending, checkError, downloadError } = Updates.useUpdates();

  useEffect(() => {
    if (!isUpdatePending) return;
    console.info('update is downloaded, the app restarts into it');
    Updates.reloadAsync().catch((error) =>
      console.warn('update fails to apply now, it runs from the next launch:', error),
    );
  }, [isUpdatePending]);

  useEffect(() => {
    const error = checkError ?? downloadError;
    if (error) console.warn('update check fails, the app runs the bundle it has:', error);
  }, [checkError, downloadError]);
}
