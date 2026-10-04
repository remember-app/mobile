import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, checkUsername, isValidUsername } from '@/api';
import { Button, Field, type FieldState } from '@/kit';
import { useAuth } from '@/lib/auth';
import { type Failure, failure } from '@/lib/failure';
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
 * Claiming a username, whoever draws it: the first claim on the way in (/set-username), where the
 * field stands in the step and its button at the bottom edge, and the change on /profile, which puts
 * both on a sheet (`UsernameForm`).
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
export function useUsername({
  onClaimed,
  onConsentNeeded,
}: {
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
} = {}) {
  const { token, user, setUsername } = useAuth();
  const [value, setValue] = useState(user?.username ?? '');
  const [busy, setBusy] = useState(false);
  // What the api said about the name that was sent, and — apart from it — a failure that says
  // nothing about the name at all: no connection, a server that fell over.
  const [refused, setRefused] = useState<'taken' | 'format' | null>(null);
  const [failed, setFailed] = useState<Failure | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);

  const typed = value.trim();
  // The name the account already holds — what /profile opens with. The api answers «free» about it
  // (re-sending it claims nothing, see `checkUsername`), and that answer painted the field green on
  // a name that is not free at all: it is taken, by the person reading it. There is no question
  // here, so none is asked and the field stays neutral until the name actually changes.
  const unchanged = typed === (user?.username ?? '');
  const malformed = typed !== '' && !isValidUsername(typed);
  const taken = refused === 'taken' || availability === 'taken';
  const format = refused === 'format' || malformed;
  // Nothing to say yet — being asked included — is the kit's neutral field, not a third state.
  const state: FieldState | undefined =
    format || taken ? 'error' : availability === 'free' ? 'ok' : undefined;

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

  /** What the server said was about the name that was sent, so it goes as soon as the name does. */
  function change(next: string) {
    setValue(next);
    setRefused(null);
    setFailed(null);
  }

  async function submit() {
    const username = value.trim();
    if (!isValidUsername(username)) {
      setRefused('format');
      return;
    }
    setBusy(true);
    setRefused(null);
    setFailed(null);
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
      // Still the last word: the check ran before this call, and the name could have gone in
      // between.
      if (e instanceof ApiError && e.status === 409) setRefused('taken');
      else if (e instanceof ApiError && e.status === 400) setRefused('format');
      else setFailed(failure(e));
    } finally {
      setBusy(false);
    }
  }

  return {
    value,
    change,
    typed,
    unchanged,
    busy,
    availability,
    taken,
    format,
    failed,
    // What the field says about itself, which is the failure's own words and no sign: a hint under
    // a box is not a banner (TASK-275).
    hint: failed?.text,
    state,
    submit,
  };
}

/** A name being claimed — `useUsername` — for the field and the button that draw it. */
export type Username = ReturnType<typeof useUsername>;

/**
 * The username field (spec 7.3 — 60 tall, typed in the headline face, with the `@` standing in front
 * of it rather than typed by the person), in either of its two places.
 *
 * On the way in (`wayIn`, spec 8, `Username`) the answer is one word beside the label — «СВОБОДЕН»,
 * «ЗАНЯТ» — a spinner where the tick would be while the server is asked, and nothing under the box:
 * what the name is for is said by the step's head, and a failure that is not about the name stands
 * over the button. On the sheet the line under the box says it all, as it always has.
 */
export function UsernameField({ name, wayIn }: { name: Username; wayIn?: boolean }) {
  const s = useStrings();
  const { availability, format, taken, failed } = name;
  // On the sheet a failure that is not about the name still reds the field it is written under.
  const state = !wayIn && failed ? 'error' : name.state;

  const hint = wayIn
    ? format
      ? s.error.usernameFormat
      : taken
        ? s.username.taken
        : availability === 'free'
          ? s.username.available
          : undefined
    : // One rule for the colour and the words: whatever puts the field in error says why in the
      // same breath — `malformed` is settled in render and `availability` only in the effect after
      // it, so a name typed down to something malformed would otherwise paint a frame of red field
      // under a green «Username is free.». With nothing wrong and nothing to report — an empty
      // field, a check that could not be made — the line says what the name is *for* (spec 8,
      // `Username`): the rule about letters and length is what a broken name is answered with.
      (failed?.text ??
      (format
        ? s.error.usernameFormat
        : taken
          ? s.error.usernameTaken
          : availability === null
            ? s.username.lead
            : availabilityHint(s)[availability]));

  return (
    <Field
      label={s.username.label}
      variant="username"
      prefix="@"
      placeholder={s.username.placeholder}
      value={name.value}
      onChangeText={name.change}
      state={state}
      hint={hint}
      hintAbove={wayIn}
      // Spec 8, `Username`: a free name is answered and then told what it is for, on one line.
      hintAfter={!wayIn && state === 'ok' ? s.username.lead : undefined}
      pending={wayIn && availability === 'checking'}
      autoCapitalize="none"
      autoCorrect={false}
      editable={!name.busy}
    />
  );
}

/** The username's button: the ember comes on only once there is a different name to claim. */
export function UsernameButton({ name, label }: { name: Username; label: string }) {
  return (
    // The ember marks the thing there is to do, and on /profile at rest there is none: the field
    // opens holding the name the account already has, and a glowing «Change username» over it asks
    // for a change nobody is making. So the same `unchanged` that keeps the check from being asked
    // keeps the glow off, and it comes on the moment the name in the field is a different one. On
    // the way in there is no saved name to equal, so anything typed lights it.
    <Button
      label={label}
      variant={name.unchanged ? 'secondary' : 'primary'}
      wide
      busy={name.busy}
      disabled={name.typed === ''}
      onPress={name.submit}
    />
  );
}

/** The change of a username on /profile's sheet: the field and its button, one under the other. */
export function UsernameForm({
  submitLabel,
  onClaimed,
}: {
  submitLabel: string;
  onClaimed?: () => void;
}) {
  const name = useUsername({ onClaimed });

  return (
    <View style={styles.form}>
      <UsernameField name={name} />
      <UsernameButton name={name} label={submitLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The column of 12, the button included.
  form: { alignSelf: 'stretch', gap: space.s3 },
});
