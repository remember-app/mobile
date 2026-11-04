import { useFocusEffect, useRouter } from 'expo-router';
import { Search, UserPlus, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ApiError,
  addContact,
  type Contact,
  isValidUsername,
  listContacts,
  memberHandle,
  memberName,
  removeContact,
} from '@/api';
import {
  AppBar,
  BackButton,
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
import { type Failure, failure } from '@/lib/failure';
import { matches, useFindUser } from '@/lib/find-user';
import { useStrings } from '@/lib/language';
import { board, duration, space, themed } from '@/theme';
export default function ContactsScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<Failure | null>(null);
  const [typed, setTyped] = useState('');
  const [saving, setSaving] = useState(false);
  const [gone, setGone] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    listContacts(token).then(setContacts, (e: unknown) => setError(failure(e)));
  }, [token]);
  useFocusEffect(load);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  const query = typed.trim().replace(/^@+/, '');
  const needle = query.toLowerCase();
  const list = contacts ?? [];
  const shown = list.filter((contact) => matches(contact, needle));
  const saved = list.some((contact) => contact.username?.toLowerCase() === needle);
  const { found, looking } = useFindUser(token, query, { skip: saved, selfId: user?.id });
  const cancel = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setGone((ids) => ids.filter((held) => held !== id));
  }, []);
  function drop(contact: Contact) {
    if (!token) return;
    setNotice(null);
    setGone((ids) => [...ids, contact.id]);
    removeContact(token, contact.id).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404) return;
      setNotice(failure(e));
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
  function undo(contact: Contact) {
    cancel(contact.id);
    if (!token || !contact.username) return;
    setNotice(null);
    addContact(token, contact.username).catch((e: unknown) => {
      setNotice(failure(e));
      setContacts((held) => held?.filter((row) => row.id !== contact.id) ?? null);
    });
  }
  async function save(person: Contact) {
    if (!token || !person.username) return;
    setSaving(true);
    setNotice(null);
    try {
      const added = await addContact(token, person.username);
      setContacts((held) => [...(held ?? []), added].sort(byUsername));
    } catch (e) {
      setNotice(failure(e));
    } finally {
      setSaving(false);
    }
  }
  const stranger = found === 'none' ? null : found;
  const nothing = shown.length === 0 && stranger === null;
  return (
    <Board
      bar={
        <>
          <AppBar
            title={s.contacts.title}
            left={
              <BackButton
                label={s.action.back}
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
      body={[
        styles.body,
        nothing ? styles.mid : { paddingBottom: Math.max(insets.bottom, board.bottom) },
      ]}
    >
      {error !== null ? (
        <Banner tone="error" failure={error}>
          <Button size="xs" variant="quiet" label={s.action.retry} onPress={load} />
        </Banner>
      ) : contacts === null ? (
        <Empty busy text={s.state.loading} />
      ) : (
        <>
          {notice !== null ? <Banner tone="error" failure={notice} /> : null}

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
                  labelRole="controlSm"
                  label={s.contacts.save}
                  busy={saving}
                  onPress={() => save(stranger)}
                />
              </RowContact>
            </View>
          ) : null}

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
                    handle={fading ? s.contacts.removed : memberHandle(contact)}
                    variant={fading ? 'gone' : 'saved'}
                    divider={index > 0}
                  >
                    {fading ? (
                      <Button
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
const byUsername = (a: Contact, b: Contact) =>
  (a.username ?? '').localeCompare(b.username ?? '', undefined, { sensitivity: 'base' });
const useStyles = themed(() =>
  StyleSheet.create({
    head: { paddingHorizontal: space.s4, paddingTop: space.s3 },
    body: { flexGrow: 1, gap: 18, paddingHorizontal: space.s4, paddingTop: space.s6 },
    mid: { justifyContent: 'center' },
    section: { gap: 10 },
  }),
);
