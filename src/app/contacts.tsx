import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, Search, UserPlus, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  addContact,
  type Contact,
  errorMessage,
  isValidUsername,
  listContacts,
  memberHandle,
  memberName,
  removeContact,
} from '@/api';
import {
  AppBar,
  Banner,
  Board,
  Button,
  DayHead,
  Empty,
  Field,
  IconButton,
  RowContact,
  Text,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { matches, useFindUser } from '@/lib/find-user';
import { useStrings } from '@/lib/language';
import { board, duration, space, themed } from '@/theme';

/**
 * `Contacts` (spec 8): the names one invites from (doc-10). The only list in the product a person
 * keeps about themselves rather than about an event, and the whole of it is a flat list of usernames:
 * being on it is not friendship, grants nothing, and is never told to the person on it.
 *
 * One field does both jobs, and it is nailed to the bar rather than scrolling with the list — it is
 * the way to add as much as the way to search. What is typed narrows the list under it, and if nobody
 * saved holds that name the api is asked whether anybody in Remember does; the answer arrives as one
 * row under «Не в контактах» with «Сохранить» on it. Two fields would ask the person to choose
 * between «искать» and «добавить» before typing the very same word into either, which is the product
 * thinking with their hands instead of for them.
 */
export default function ContactsScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  // null is «not loaded yet», the distinction the home screen draws: a refetch keeps the list on
  // screen instead of flashing the spinner over it.
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A failure of something pressed, which is not the same as the list failing to arrive: it goes as a
  // strip over the list and leaves the row that was pressed exactly where it was.
  const [notice, setNotice] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [saving, setSaving] = useState(false);
  // Rows that have already been deleted server-side and are standing their five seconds. Ids and
  // not the rows themselves: the row is still in `contacts` and must not be drawn from two places.
  const [gone, setGone] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    listContacts(token).then(setContacts, (e: unknown) => setError(errorMessage(e)));
  }, [token]);

  useFocusEffect(load);

  // Nothing may fire after the screen is gone: every one of these holds a `setState` on a list that
  // will not be there. The map is read into a local first — by the time the cleanup runs the ref
  // could be pointing at another render's.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // Spec 8, «Края»: a username typed with a capital or with the @ still on it is taken as it is and
  // brought to the product's own shape here. What the api matches on is case-insensitive anyway, so
  // this is about the list under the field as much as about the lookup.
  const query = typed.trim().replace(/^@+/, '');
  const needle = query.toLowerCase();
  const list = contacts ?? [];
  const shown = list.filter((contact) => matches(contact, needle));
  // «Уже сохранённого ник вводом не задваивает»: an exact hit among the saved is answered by the
  // list itself, so nothing is asked of the api and no second row is offered.
  const saved = list.some((contact) => contact.username?.toLowerCase() === needle);
  // The other half of the field's job, shared with the invite sheet's own (`@/lib/find-user`). Oneself
  // comes back as nothing to say: the api refuses to save you (400), so the row is not offered at
  // all rather than offered and then refused, and silently — «нет такого ника» would be a lie.
  const { found, looking } = useFindUser(token, query, { skip: saved, selfId: user?.id });

  /** Put a fading row back on its feet: the five seconds are off, and the name lights again. */
  const cancel = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setGone((ids) => ids.filter((held) => held !== id));
  }, []);

  /**
   * The cross, and no sheet behind it (spec 7.5, «убранный»): nothing is lost — that person keeps
   * every memory they are in, and the name comes back with one press. So the call goes out at once
   * and the row, still in place, spends five seconds offering the way back.
   */
  function drop(contact: Contact) {
    if (!token) return;
    setNotice(null);
    setGone((ids) => [...ids, contact.id]);
    removeContact(token, contact.id).catch((e: unknown) => {
      // Already off the list is what the row is saying anyway, so it goes on fading. Anything else
      // did not happen, and a row that fades over a contact still on the server is a lie the next
      // focus would contradict.
      if (e instanceof ApiError && e.status === 404) return;
      setNotice(errorMessage(e));
      cancel(contact.id);
    });
    timers.current.set(
      contact.id,
      setTimeout(() => {
        timers.current.delete(contact.id);
        setContacts((held) => held?.filter((row) => row.id !== contact.id) ?? null);
        setGone((ids) => ids.filter((held) => held !== contact.id));
      }, duration.undo),
    );
  }

  /** «Вернуть» — off the row that is still standing there, so nothing has to be typed again. */
  function undo(contact: Contact) {
    cancel(contact.id);
    if (!token || !contact.username) return;
    setNotice(null);
    addContact(token, contact.username).catch((e: unknown) => {
      setNotice(errorMessage(e));
      // The delete went through; only the way back did not. A row left standing here would be a
      // live contact with a working cross over somebody the api no longer has — so it goes, and
      // the strip above says why.
      setContacts((held) => held?.filter((row) => row.id !== contact.id) ?? null);
    });
  }

  /**
   * «Сохранить», on the one row standing under «Не в контактах». The row moves into the list itself
   * rather than the screen being redrawn around it, so the field keeps what was typed and the list
   * under it now answers with the person who was just saved.
   */
  async function save(person: Contact) {
    if (!token || !person.username) return;
    setSaving(true);
    setNotice(null);
    try {
      const added = await addContact(token, person.username);
      // Sorted by username, which is the order the api itself keeps: a list read by eye must not
      // reshuffle between one visit and the next, and one saved row must not put it out of step.
      // Nothing clears the row under «Не в контактах» here: the saved name now answers `saved`,
      // which is what takes the question down. Clearing it by hand would take down whatever the
      // field has turned up since, if the typing went on while this call was in the air.
      setContacts((held) => [...(held ?? []), added].sort(byUsername));
    } catch (e) {
      // The strip goes over the list and the row keeps its button: whoever pressed it is still
      // looking at the person they meant to save.
      setNotice(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const stranger = found === 'none' ? null : found;
  // Neither a saved row nor a stranger: the body has nothing to hold, and what it says instead
  // stands in the middle of it rather than at the top (spec 8, `ContactsEmpty`).
  const nothing = shown.length === 0 && stranger === null;

  return (
    <Board
      // The head: the bar and the field together, and the field does not scroll away with the list
      // — it is the way to add as much as the way to search.
      bar={
        <>
          <AppBar
            title={s.contacts.title}
            left={
              <IconButton
                icon={ChevronLeft}
                label={s.action.back}
                // Same as everywhere else: nothing behind means home, never a button that answers
                // nothing.
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              />
            }
          />
          <View style={styles.head}>
            <Field
              variant="search"
              icon={Search}
              prefix="@"
              label={s.username.label}
              labelHidden
              value={typed}
              onChangeText={setTyped}
              placeholder={s.username.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              // The check is answered in the field, the way the invite sheet answers it. «Такого
              // ника нет» only while the list under it still has rows — with nothing under it the
              // body says the same thing at length and names the ник, and saying it twice says it
              // once.
              state={found === 'none' && shown.length > 0 ? 'error' : undefined}
              hint={
                looking
                  ? s.state.checking
                  : found === 'none' && shown.length > 0
                    ? s.members.noSuchUser
                    : undefined
              }
            />
          </View>
        </>
      }
      // The rows keep clear of the phone's bottom edge; the empty state in the middle is centred on
      // the whole body down to that edge, as `ContactsEmpty` draws it (184 to 844).
      body={[
        styles.body,
        nothing ? styles.mid : { paddingBottom: Math.max(insets.bottom, board.bottom) },
      ]}
    >
      {error !== null ? (
        // The list did not come: the strip holds its place and offers the one thing left to do.
        <Banner tone="error" text={error}>
          <Button size="xs" variant="quiet" label={s.action.retry} onPress={load} />
        </Banner>
      ) : contacts === null ? (
        <Empty busy text={s.state.loading} />
      ) : (
        <>
          {notice !== null ? <Banner tone="error" text={notice} /> : null}

          {/* Found in Remember and not saved yet: its own rule, one row, one action — and it
              stands above the saved list, where the eye already is after typing. */}
          {stranger !== null ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" role="eyebrow" tone="muted">
                {s.contacts.notSaved.toUpperCase()}
              </Text>
              <RowContact
                variant="found"
                name={memberName(stranger)}
                handle={memberHandle(stranger)}
              >
                <Button
                  variant="primary"
                  size="sm"
                  wide={false}
                  // Spec 7.2, «Малая с текстом»: `Contacts` says «Сохранить» at 14, not 16.
                  labelRole="controlSm"
                  label={s.contacts.save}
                  busy={saving}
                  onPress={() => save(stranger)}
                />
              </RowContact>
            </View>
          ) : null}

          {/* The saved, under their own heading with the count on the end of its rule — the eyebrow,
              not a seam of a feed (`Contacts.json` e17–e19). One View around the rows so they keep
              the hairline and padding of a list instead of the gap this body puts between its
              groups. */}
          {shown.length > 0 ? (
            <View>
              <DayHead
                eyebrow
                label={s.contacts.saved.toUpperCase()}
                count={String(shown.length)}
              />
              {shown.map((contact, index) => {
                const fading = gone.includes(contact.id);
                const name = memberName(contact);

                return (
                  <RowContact
                    key={contact.id}
                    name={name}
                    // The username where a member row carries a standing — a contact uploads
                    // nothing, so there is no role and no count to write here.
                    handle={fading ? s.contacts.removed : memberHandle(contact)}
                    variant={fading ? 'gone' : 'saved'}
                    divider={index > 0}
                  >
                    {fading ? (
                      <Button
                        // Spec 7.2, «в строке»: 36 in `lineStrong`, as `Contacts` draws it.
                        size="mini"
                        wide={false}
                        label={s.contacts.undo}
                        onPress={() => undo(contact)}
                      />
                    ) : (
                      <IconButton
                        size={36}
                        icon={X}
                        label={s.contacts.remove(name)}
                        onPress={() => drop(contact)}
                      />
                    )}
                  </RowContact>
                );
              })}
            </View>
          ) : null}

          {/* Empty is an invitation and not a report: with nothing typed the field itself is the
              way to add somebody, and that is what the paragraph sends them to. With something
              typed and nobody anywhere holding it, the answer names the ник that was asked for —
              and a ник nobody *could* hold is that same answer without the asking. Without that
              second half the body came out blank: two letters, a space, or anything Cyrillic never
              reaches the api, so `found` stayed null and neither line was drawn. */}
          {nothing && query === '' ? (
            <Empty icon={UserPlus} title={s.contacts.emptyTitle} text={s.contacts.empty} />
          ) : nothing && (found === 'none' || !isValidUsername(query)) ? (
            <Empty text={s.contacts.noUser(query)} />
          ) : null}
        </>
      )}
    </Board>
  );
}

/** The api's own order: `order by u.username`, case-folded by citext. */
const byUsername = (a: Contact, b: Contact) =>
  (a.username ?? '').localeCompare(b.username ?? '', undefined, { sensitivity: 'base' });

const useStyles = themed(() =>
  StyleSheet.create({
    // Spec 8 says it once for every screen: «Боковой отступ 16 задаёт экран». The 12 is the field's
    // own gap under the bar — both belong to the head, which does not scroll.
    head: { paddingHorizontal: space.s4, paddingTop: space.s3 },
    // The body starts 24 under the field (spec 8: тело со 184) and grows to the full height — which
    // is what gives the empty state a middle to stand in. Its groups stand 18 apart: «НЕ В
    // КОНТАКТАХ» ends at 276 and «СОХРАНЁННЫЕ» starts at 294 (`Contacts.html`).
    body: { flexGrow: 1, gap: 18, paddingHorizontal: space.s4, paddingTop: space.s6 },
    // The spec's `.screen__body-mid`.
    mid: { justifyContent: 'center' },
    // The rule and the row it introduces: 10 between them in `Contacts`.
    section: { gap: 10 },
  }),
);
