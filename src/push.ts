import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { registerPushToken } from '@/api';
import { useAuth } from '@/auth';

/**
 * An invite link followed while signed out. Module state and not storage on purpose: the
 * sign-in that follows happens in this same runtime, and a token that outlived the app would
 * drop somebody into a memory they no longer remember asking to join.
 */
let pendingInvite: string | null = null;

export function stashInvite(token: string) {
  pendingInvite = token;
}

/**
 * Read without consuming. The token is carried to the invite screen in this module and never
 * through the url: the navigation that reopens that screen is issued while the gate is
 * swapping one set of screens for another, and a param handed to `replace` in that moment is
 * dropped — the screen arrives with an empty `token` and says the link is broken when it is not.
 */
export function peekInvite(): string | null {
  return pendingInvite;
}

/** Done with it — cleared by whoever acted on it, so a re-render cannot lose it mid-flight. */
export function clearInvite() {
  pendingInvite = null;
}

/** The session this device is already registered under — so registration runs once per sign-in. */
let registeredFor: string | null = null;

/** A cold-start tap is answered once; a later sign-out/in must not replay it. */
let coldStartAnswered = false;

async function register(session: string) {
  try {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;
    const { data } = await Notifications.getExpoPushTokenAsync();
    await registerPushToken(session, data, Platform.OS);
  } catch (error) {
    // Expected on a simulator and wherever no EAS projectId is configured: there is no remote
    // push token to be had. Pushes are one way of hearing about an invite, never the only one,
    // so this stays a line in the log and never a screen.
    registeredFor = null;
    // The error itself and not `errorMessage()`: that one is worded for a screen and would
    // call a missing projectId «cannot reach the api», which is the wrong thing to go chasing.
    console.warn('push registration skipped:', error);
  }
}

/** Where the invite push points: the memory it is about, on the screen it is asking for. */
function openUpload(response: Notifications.NotificationResponse | null) {
  const memoryId = response?.notification.request.content.data?.memoryId;
  if (typeof memoryId === 'string') {
    router.push({ pathname: '/memory/[id]/upload', params: { id: memoryId } });
  }
}

/**
 * Everything that happens to a signed-in app from outside a screen: registering for pushes,
 * following a tapped one, and finishing an invite that was followed before there was a session.
 * Called once from the root navigator, inside the auth provider.
 */
export function usePush() {
  const { status, token } = useAuth();
  const ready = status === 'ready' && token !== null;

  useEffect(() => {
    if (!ready) return;
    if (registeredFor !== token) {
      registeredFor = token;
      void register(token);
    }
    // The accepting itself belongs to the invite screen — this only reopens it, so there is one
    // place that joins a memory and one wording when the link is dead. The token travels in the
    // module rather than in this href; `peekInvite` says why.
    if (pendingInvite !== null) router.replace('/invite');
  }, [ready, token]);

  useEffect(() => {
    if (!ready) return;
    if (!coldStartAnswered) {
      coldStartAnswered = true;
      // A tap that launched the app: the response is waiting rather than delivered, and it is
      // read here — after the session is restored — so the screen it opens is allowed to exist.
      Notifications.getLastNotificationResponseAsync().then(openUpload, () => {});
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(openUpload);
    return () => subscription.remove();
  }, [ready]);
}
