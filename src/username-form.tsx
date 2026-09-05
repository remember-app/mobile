import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, checkUsername, errorMessage, isValidUsername, USERNAME_HINT } from '@/api';
import { useAuth } from '@/auth';
import { Button, Field, type FieldState } from '@/kit';
import { space } from '@/theme';

/** Long enough that a typed word is one question, short enough to answer before the thumb moves. */
const CHECK_DELAY_MS = 400;

/** One wording for one fact, whether the check found it or the submit did. */
const TAKEN = 'That username is taken — pick another.';

/** Where the server stands on the name in the field. `null` is «nothing to say». */
type Availability = 'checking' | 'free' | 'taken';

const AVAILABILITY_HINT: Record<Availability, string> = {
  checking: 'Checking…',
  free: 'Username is free.',
  taken: TAKEN,
};

/**
 * The one username field, shared by the first claim (/set-username) and the change (/profile).
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
export function UsernameForm({ submitLabel }: { submitLabel: string }) {
  const { token, user, setUsername } = useAuth();
  const [value, setValue] = useState(user?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);

  const typed = value.trim();
  const malformed = typed !== '' && !isValidUsername(typed);
  // Nothing to say yet — being asked included — is the kit's neutral field, not a third state.
  const state: FieldState | undefined =
    error !== null || malformed || availability === 'taken'
      ? 'error'
      : availability === 'free'
        ? 'ok'
        : undefined;

  useEffect(() => {
    if (token === null || !isValidUsername(typed)) {
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
  }, [token, typed]);

  async function submit() {
    const username = value.trim();
    if (!isValidUsername(username)) {
      setError(USERNAME_HINT);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setUsername(username);
    } catch (e) {
      setError(
        // Still the last word: the check ran before this call, and the name could have gone in
        // between.
        e instanceof ApiError && e.status === 409
          ? TAKEN
          : e instanceof ApiError && e.status === 400
            ? USERNAME_HINT
            : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Field
        label="Username"
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
        hint={
          error ??
          (malformed || availability === null ? USERNAME_HINT : AVAILABILITY_HINT[availability])
        }
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />
      <Button
        label={submitLabel}
        variant="primary"
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
