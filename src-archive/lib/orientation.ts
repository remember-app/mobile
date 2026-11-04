import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
export function lockPortrait() {
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
}
export function useTurnsWithPhone(open: boolean) {
  useEffect(() => {
    if (!open) return;
    ScreenOrientation.unlockAsync().catch(() => {});
    return lockPortrait;
  }, [open]);
}
