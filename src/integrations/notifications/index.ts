import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { PushPlatform } from '@/types/push';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushPayload = {
  kind?: string;
  projectId?: string;
  montageId?: string;
};

export const pushPlatform = (): PushPlatform | null =>
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : null;

export async function permissionGranted(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function expoPushToken(): Promise<string | null> {
  try {
    const { data } = await Notifications.getExpoPushTokenAsync();
    return data;
  } catch (error) {
    console.warn('push token is unavailable:', error);
    return null;
  }
}

function payloadOf(response: Notifications.NotificationResponse | null): PushPayload | null {
  const data = response?.notification.request.content.data;
  if (!data || typeof data !== 'object') return null;
  return {
    ...(typeof data.kind === 'string' ? { kind: data.kind } : {}),
    ...(typeof data.projectId === 'string' ? { projectId: data.projectId } : {}),
    ...(typeof data.montageId === 'string' ? { montageId: data.montageId } : {}),
  };
}

export function onPushOpened(listener: (payload: PushPayload) => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    const payload = payloadOf(response);
    if (payload) listener(payload);
  };
  Notifications.getLastNotificationResponseAsync().then(handle, () => undefined);
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
