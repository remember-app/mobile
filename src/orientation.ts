// Which way up the app is allowed to be. `app.json` used to answer this on its own with
// `"orientation": "portrait"` — a static lock written into Info.plist and the Android manifest at
// build time, which stands above anything js says afterwards. That is why the two viewers'
// `supportedOrientations` did nothing on a real phone: the app was already nailed down before react
// was asked (TASK-124). The app config now says `"default"`, and the answer is given here instead —
// portrait from the root layout, lifted for as long as a full-screen viewer is open.

import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';

/**
 * Portrait, the app's standing state: every screen in the product but the two viewers below. Called
 * once as the root layout loads, and again each time a viewer closes.
 *
 * Fire-and-forget with the failure swallowed, here and below: on web there is no orientation to hold
 * unless the page is full screen, and a rejected promise there is not a reason for a screen to
 * break. Nothing in the app reads back which way up it currently is.
 */
export function lockPortrait() {
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
}

/**
 * A viewer that turns with the phone while it is open — the frame opened full screen and the montage
 * being played, and nothing else in the product (TASK-124).
 *
 * `open` is the modal's own `visible`: both modals stay mounted with the face around them, so this
 * follows the flag and not the mount. Closing one — or leaving the screen with one open — hands the
 * app back to portrait.
 */
export function useTurnsWithPhone(open: boolean) {
  useEffect(() => {
    if (!open) return;
    // `unlockAsync` is the DEFAULT policy rather than «any orientation at all»: on ios every way up
    // except upside down, on android whatever the system reads off the sensor. Which is what «turns
    // with the phone» means to somebody holding one.
    ScreenOrientation.unlockAsync().catch(() => {});
    return lockPortrait;
  }, [open]);
}
