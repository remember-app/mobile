import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, checkUsername, errorMessage, isValidUsername } from '@/api';
import { Button, Field, type FieldState } from '@/kit';
import { useAuth } from '@/lib/auth';
import { useStrings } from '@/lib/language';
import type { Strings } from '@/strings';
import { space } from '@/theme';

/** Long enough that a typed word is one question, short enough to answer before the thumb moves. */
const CHECK_DELAY_MS = 400;

/** Where the server stands on the name in the field. `null` is «nothing to say». */
type Availability = 'checking' | 'free' | 'taken';

/**
 * What the field says under itself for each of the three. `error.usernameTaken` is the one wording
 * for one fact, whether the check found it or the submit did — so both roads read the same key.
 */
const availabilityHint = (s: Strings): Record<Availability, string> => ({
  checking: s.state.checking,
  free: s.username.free,
  taken: s.error.usernameTaken,
});

/**
 * The one username field, shared by the first claim (/set-username) and the change (the pencil on
 * /profile, which puts it on a sheet).
 *
 * The kit's field answers before the form is sent (section 4, «Ник»): «Ник свободен.» is the
 * server's word, not this side's guess, so a well-formed name is asked about while it is being
 * typed. `isValidUsername` only decides whether there is anything worth asking — an answer for a
 * name that could never be held is a 400, not a «free».
 *
 * The check is a courtesy, never the guard: it is one question about a name nobody has promised to
 * hold. Another device can claim it between the answer and the submit, and the 409 below is what
 * catches that — the same line the check would have shown.
 */
export function UsernameForm({
  submitLabel,
  onClaimed,
  onConsentNeeded,
}: {
  submitLabel: string;
  /**
   * The api took the name. The first claim needs nothing here — the gate moves the person on — but
   * a change made on a sheet has a sheet to close.
   */
  onClaimed?: () => void;
  /**
   * The api refused the first claim because the agreement has not been accepted (403, TASK-139).
   * Holding a username *is* being registered, so that answer is not an error to print but a screen
   * to be on — and which screen that is belongs to whoever put this form up, not to the form.
   */
  onConsentNeeded?: () => void;
}) {
  const { token, user, setUsername } = useAuth();
  const s = useStrings();
  const [value, setValue] = useState(user?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);

  const typed = value.trim();
  // The name the account already holds — what /profile opens with. The api answers «free» about it
  // (re-sending it claims nothing, see `checkUsername`), and that answer painted the field green on
  // a name that is not free at all: it is taken, by the person reading it. There is no question
  // here, so none is asked and the field stays neutral until the name actually changes.
  const unchanged = typed === (user?.username ?? '');
  const malformed = typed !== '' && !isValidUsername(typed);
  // Nothing to say yet — being asked included — is the kit's neutral field, not a third state.
  const state: FieldState | undefined =
    error !== null || malformed || availability === 'taken'
      ? 'error'
      : availability === 'free'
        ? 'ok'
        : undefined;

  useEffect(() => {
    if (token === null || unchanged || !isValidUsername(typed)) {
      setAvailability(null);
      return;
    }
    setAvailability('checking');
    let live = true;
    // Waits out the typing rather than asking after every key; the cleanup below drops both the
    // question that never went out and the answer to one that did — a slow reply about a name the
    // field has since left can never overwrite a fresher one.
    const timer = setTimeout(() => {
      checkUsername(token, typed).then(
        ({ available }) => {
          if (live) setAvailability(available ? 'free' : 'taken');
        },
        () => {
          // A check that could not be made says nothing about the name. The field goes quiet and
          // the submit stays the answer — this was never the thing standing between the two.
          if (live) setAvailability(null);
        },
      );
    }, CHECK_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [token, typed, unchanged]);

  async function submit() {
    const username = value.trim();
    if (!isValidUsername(username)) {
      setError(s.error.usernameFormat);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setUsername(username);
      onClaimed?.();
    } catch (e) {
      // Not a line about the name at all: the account has not accepted the agreement, and the way
      // out of that is the screen that asks for it — pressing this again would only earn the same
      // 403. The api is the one gate on registering, so this can happen to a person who left the
      // way in half-walked and came back to it.
      if (e instanceof ApiError && e.status === 403 && onConsentNeeded) {
        onConsentNeeded();
        return;
      }
      setError(
        // Still the last word: the check ran before this call, and the name could have gone in
        // between.
        e instanceof ApiError && e.status === 409
          ? s.error.usernameTaken
          : e instanceof ApiError && e.status === 400
            ? s.error.usernameFormat
            : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Field
        label={s.username.label}
        // Spec 7.3 — the username field: 60 tall, typed in the headline face, with the `@` standing
        // in front of it rather than typed by the person.
        variant="username"
        prefix="@"
        placeholder={s.username.placeholder}
        value={value}
        // What the server said was about the name that was sent, so it goes as soon as the name does.
        onChangeText={(next) => {
          setValue(next);
          setError(null);
        }}
        state={state}
        // `malformed` is settled in render and `availability` only in the effect after it, so a
        // name typed down to something malformed paints a frame of red field under a green
        // «Username is free.» unless the format is asked here too. One rule for the colour and the
        // words: whatever puts the field in error says why in the same breath.
        //
        // With nothing wrong and nothing to report — an empty field, a check that could not be
        // made — the line says what the name is *for* (spec 8, `Username`: «По нему вас найдут в
        // воспоминании»). The rule about letters and length is what a broken name is answered
        // with, and standing there before anything is typed it only reads as a warning about
        // nothing.
        hint={
          error ??
          (malformed
            ? s.error.usernameFormat
            : availability === null
              ? s.username.lead
              : availabilityHint(s)[availability])
        }
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />
      {/* The ember marks the thing there is to do, and on /profile at rest there is none: the field
          opens holding the name the account already has, and a glowing «Change username» over it
          asks for a change nobody is making. So the same `unchanged` that keeps the check from being
          asked keeps the glow off, and it comes on the moment the name in the field is a different
          one. On /set-username there is no saved name to equal, so anything typed lights it. */}
      <Button
        label={submitLabel}
        variant={unchanged ? 'secondary' : 'primary'}
        wide
        busy={busy}
        disabled={typed === ''}
        onPress={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { alignSelf: 'stretch', gap: space.s5 },
});
