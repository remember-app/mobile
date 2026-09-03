import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ApiError,
  errorMessage,
  fetchInvite,
  inviteByUsername,
  listMemories,
  listMembers,
  removeMember,
  rotateInvite,
  type Invite,
  type Member,
  type MemberRole,
  type Memory,
} from '@/api';
import { useAuth } from '@/auth';
import { formatEventDates } from '@/dates';

/** The three levels of doc-01 «Права доступа», said the way a person would say them. */
const ROLE: Record<MemberRole, string> = {
  organizer: 'Organizer',
  contributor: 'Can add photos',
  viewer: 'View only',
};

/** Whoever it is, under whichever of the two names they have. */
const label = (member: Member) => member.name ?? member.username ?? 'Someone';

/**
 * One memory: who is in it, how to get more people in, and how to get out. What the caller
 * may do is read off their own row in the roster — the api is the authority on that, so
 * nothing here is gated on anything the client made up.
 */
export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  // null means «not loaded yet» — the same distinction the home screen draws, so a refetch
  // after an invite keeps the roster on screen instead of flashing the spinner over it.
  const [members, setMembers] = useState<Member[] | null>(null);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [username, setUsername] = useState('');
  // The level newcomers get, by both roads at once: it is what an invite by username grants
  // and what a rotated link will grant, so there is one answer to «what does joining give».
  const [mayAdd, setMayAdd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    // The roster carries no memory, and the title belongs on this screen — so the list the
    // home screen already reads answers for the header too. Costs one request and works the
    // same however this screen was reached, which nav params would not.
    Promise.all([listMembers(token, id), listMemories(token)]).then(
      ([roster, memories]) => {
        setMembers(roster);
        setMemory(memories.find((one) => one.id === id) ?? null);
      },
      (e: unknown) => setError(errorMessage(e)),
    );
  }, [token, id]);

  useEffect(load, [load]);

  const me = members?.find((member) => member.id === user?.id) ?? null;
  const role = me?.role ?? null;
  // doc-01: adding people is «Добавление» and up. A viewer may look and leave, nothing else.
  const mayInvite = role === 'organizer' || role === 'contributor';
  const newcomerRole = mayAdd ? 'contributor' : 'viewer';
  // Derived together so the branch below narrows both at once: there is a link exactly when
  // there is an invite. `remember://` is the scheme in app.json; TASK-16 is what receives it.
  const shareable = invite && {
    link: `remember://invite?token=${encodeURIComponent(invite.token)}`,
    grants: ROLE[invite.role],
  };

  /**
   * Every button on this screen is the same shape: lock the controls, run one call, say one
   * line about it. `said` maps the statuses this particular call can come back with; anything
   * else falls through to the api's own wording.
   */
  async function act(
    what: (session: string) => Promise<string | null>,
    said: Partial<Record<number, string>> = {},
  ) {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      setNotice(await what(token));
    } catch (e) {
      setNotice((e instanceof ApiError ? said[e.status] : undefined) ?? errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const sendInvite = () =>
    act(
      async (session) => {
        const added = await inviteByUsername(session, id, username.trim(), newcomerRole);
        // The api is idempotent and answers 200 either way, so a re-add is only visible
        // against the roster as it stood before the call.
        const already = members?.some((member) => member.id === added.id) ?? false;
        setUsername('');
        load();
        return already
          ? `${label(added)} is already here — still «${ROLE[added.role]}».`
          : `Added ${label(added)} — «${ROLE[added.role]}».`;
      },
      {
        404: 'No one has that username.',
        403: 'Only the organizer and people who can add photos may invite.',
      },
    );

  const showLink = () =>
    act(async (session) => {
      setInvite(await fetchInvite(session, id));
      return null;
    });

  const rotate = () =>
    act(async (session) => {
      setInvite(await rotateInvite(session, id, newcomerRole));
      return 'New link ready. The old one no longer opens anything.';
    });

  const drop = (target: Member) =>
    act(
      async (session) => {
        await removeMember(session, id, target.id);
        if (target.id === user?.id) router.replace('/');
        else load();
        return null;
      },
      { 404: 'They are not in this memory any more.' },
    );

  /** Both halves of the same act, and irreversible either way — doc-01 takes the media too. */
  function confirmDrop(target: Member) {
    const self = target.id === user?.id;
    Alert.alert(
      self ? 'Leave this memory?' : `Remove ${label(target)}?`,
      self
        ? 'Everything you uploaded here goes with you.'
        : 'Everything they uploaded here goes with them.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: self ? 'Leave' : 'Remove', style: 'destructive', onPress: () => void drop(target) },
      ],
    );
  }

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Button title="Try again" onPress={load} />
      </View>
    );
  }

  if (members === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.hint}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {memory ? (
        <View>
          <Text style={styles.title}>{memory.title}</Text>
          <Text style={styles.hint}>{formatEventDates(memory.event_start, memory.event_end)}</Text>
        </View>
      ) : null}

      <Text style={styles.section}>Who is here</Text>
      {/* A `.map` and not a FlatList: this is one event's guest list inside a ScrollView,
          and nesting a virtualised list in one is the thing React Native asks you not to do. */}
      {members.map((member) => (
        <View key={member.id} style={styles.row}>
          <View style={styles.who}>
            <Text style={styles.name}>
              {label(member)}
              {member.id === user?.id ? ' (you)' : ''}
            </Text>
            <Text style={styles.hint}>
              {ROLE[member.role]}
              {member.username ? ` · @${member.username}` : ''}
            </Text>
          </View>
          {role === 'organizer' && member.id !== user?.id ? (
            <Button title="Remove" color="#C0392B" onPress={() => confirmDrop(member)} disabled={busy} />
          ) : null}
        </View>
      ))}

      {mayInvite ? (
        <>
          <Text style={styles.section}>Invite someone</Text>
          <View style={styles.toggle}>
            <Text style={styles.hint}>They can add photos too</Text>
            <Switch value={mayAdd} onValueChange={setMayAdd} disabled={busy} />
          </View>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
          <Button title="Invite" onPress={sendInvite} disabled={busy || username.trim() === ''} />

          <Text style={styles.section}>Invite link</Text>
          {shareable === null ? (
            // Asked for rather than loaded with the screen: the api mints the link on this
            // very call, and a memory nobody shares should not carry one.
            <Button title="Get the link" onPress={showLink} disabled={busy} />
          ) : (
            <>
              <Text style={styles.link} selectable>
                {shareable.link}
              </Text>
              <Text style={styles.hint}>Whoever follows it joins as «{shareable.grants}».</Text>
              {/* The platform's own share sheet, which is also the copy button — no clipboard
                  dependency for something every OS already does better. */}
              <Button
                title="Share"
                onPress={() => void Share.share({ message: shareable.link }).catch(() => {})}
                disabled={busy}
              />
              <Button title="Replace the link" onPress={rotate} disabled={busy} />
            </>
          )}
        </>
      ) : null}

      {/* The organizer has no way out: leaving would leave the memory with nobody able to
          run it, and handing the role over is out of MVP (doc-01). The api says 409. */}
      {role !== null && role !== 'organizer' ? (
        <>
          <View style={styles.gap} />
          <Button
            title="Leave this memory"
            color="#C0392B"
            onPress={() => me && confirmDrop(me)}
            disabled={busy}
          />
        </>
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: '600' },
  section: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', opacity: 0.5, marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 10,
    padding: 12,
  },
  who: { flexShrink: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 12, fontSize: 16 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: {
    fontSize: 14,
    color: '#208AEF',
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
  },
  gap: { height: 24 },
  hint: { fontSize: 14, opacity: 0.6 },
  notice: { fontSize: 15, marginTop: 8 },
  error: { fontSize: 15, color: '#C0392B', textAlign: 'center' },
});
