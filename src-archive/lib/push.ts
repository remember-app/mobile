import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerPushToken } from '@/api';
import { useAuth } from '@/lib/auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
let pendingInvite: string | null = null;
export function stashInvite(token: string) {
  pendingInvite = token;
}
export function peekInvite(): string | null {
  return pendingInvite;
}
export function clearInvite() {
  pendingInvite = null;
}
let registeredFor: string | null = null;
let coldStartAnswered = false;
async function register(session: string) {
  try {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      console.warn('push registration skipped: notifications not permitted,', permission.status);
      return;
    }
    const { data } = await Notifications.getExpoPushTokenAsync();
    await registerPushToken(session, data, Platform.OS);
  } catch (error) {
    registeredFor = null;
    console.warn('push registration skipped:', error);
  }
}
function openWhatItIsAbout(response: Notifications.NotificationResponse | null) {
  const data = response?.notification.request.content.data;
  const memoryId = data?.memoryId;
  if (typeof memoryId !== 'string') return;
  if (typeof data?.montageId === 'string') {
    router.push({ pathname: '/memory/[id]', params: { id: memoryId } });
    return;
  }
  router.push({ pathname: '/memory/[id]/upload', params: { id: memoryId } });
}
export function usePush() {
  const { status, token } = useAuth();
  const ready = status === 'ready' && token !== null;
  useEffect(() => {
    if (!ready) return;
    if (registeredFor !== token) {
      registeredFor = token;
      void register(token);
    }
    if (pendingInvite !== null) router.replace('/invite');
  }, [ready, token]);
  useEffect(() => {
    if (!ready) return;
    if (!coldStartAnswered) {
      coldStartAnswered = true;
      Notifications.getLastNotificationResponseAsync().then(openWhatItIsAbout, () => {});
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(openWhatItIsAbout);
    return () => subscription.remove();
  }, [ready]);
}
