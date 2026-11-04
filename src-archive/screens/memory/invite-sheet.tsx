import { Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import {
  type Contact,
  fetchInvite,
  type Invite,
  inviteByUsername,
  listContacts,
  type Member,
  memberName,
  rotateInvite,
} from '@/api';
import { Banner, Button, Chip, Divider, Field, Sheet, Text, Toggle } from '@/kit';
import { useAuth } from '@/lib/auth';
import { type Failure, failure, type Refusals, said, saying } from '@/lib/failure';
import { matches, useFindUser } from '@/lib/find-user';
import { useStrings } from '@/lib/language';
import { space, themed } from '@/theme';
export function InviteSheet({
  visible,
  onCancel,
  memoryId,
  members,
  onInvited,
}: {
  visible: boolean;
  onCancel: () => void;
  memoryId: string;
  members: Member[] | null;
  onInvited: () => void;
}) {
  const { token, user } = useAuth();
  const s = useStrings();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [username, setUsername] = useState('');
  const [mayAdd, setMayAdd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Failure | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [picked, setPicked] = useState<Contact | null>(null);
  useEffect(() => {
    if (!visible || !token) return;
    setPicked(null);
    listContacts(token).then(setContacts, () => {});
  }, [visible, token]);
  const newcomerRole = mayAdd ? 'contributor' : 'viewer';
  const shareable = invite && {
    link: `remember://invite?token=${encodeURIComponent(invite.token)}`,
    grants: s.role[invite.role],
  };
  const query = username.trim().replace(/^@+/, '');
  const needle = query.toLowerCase();
  const pickable = (contacts ?? []).filter(
    (contact) => !members?.some((member) => member.id === contact.id) && matches(contact, needle),
  );
  const here = (members ?? []).find((member) => member.username?.toLowerCase() === needle);
  const answered =
    here !== undefined ||
    (contacts ?? []).some((contact) => contact.username?.toLowerCase() === needle);
  const { found, looking } = useFindUser(token, query, {
    skip: !visible || answered,
    selfId: user?.id,
  });
  const saved = (contacts ?? []).find((contact) => contact.username?.toLowerCase() === needle);
  const target = here ? null : (picked ?? saved ?? (found === 'none' ? null : found));
  async function act(what: (session: string) => Promise<string | null>, refused: Refusals = {}) {
    if (!token) return;
    setBusy(true);
    setNotice(null);
    try {
      const saidIt = await what(token);
      if (saidIt !== null) setNotice(said(saidIt));
    } catch (e) {
      setNotice(failure(e, refused));
    } finally {
      setBusy(false);
    }
  }
  const sendInvite = (person: Contact) => {
    const handle = person.username;
    if (!handle || busy) return;
    void act(
      async (session) => {
        const added = await inviteByUsername(session, memoryId, handle, newcomerRole);
        const already = members?.some((member) => member.id === added.id) ?? false;
        setUsername('');
        setPicked(null);
        onInvited();
        return already
          ? s.members.already(memberName(added), s.role[added.role])
          : s.members.added(memberName(added), s.role[added.role]);
      },
      { 403: { text: saying(s.members.inviteDenied) } },
    );
  };
  const styles = useStyles();
  return (
    <Sheet
      visible={visible}
      onCancel={onCancel}
      title={s.members.inviteTitle}
      footer={
        <Button
          variant="primary"
          label={s.members.inviteDo}
          busy={busy}
          disabled={target === null}
          onPress={() => (target === null ? undefined : sendInvite(target))}
        />
      }
    >
      <Field
        label={s.username.label}
        labelHidden
        variant="handle"
        onSurface
        prefix="@"
        value={username}
        onChangeText={(text) => {
          setUsername(text);
          setPicked(null);
        }}
        placeholder={s.username.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        state={found === 'none' ? 'error' : undefined}
        hint={
          looking
            ? s.state.checking
            : here
              ? s.members.already(memberName(here), s.role[here.role])
              : found === 'none'
                ? s.members.noSuchUser
                : undefined
        }
      />

      <Toggle label={s.members.mayAdd} value={mayAdd} onValueChange={setMayAdd} disabled={busy} />

      {pickable.length > 0 ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" role="eyebrow">
            {s.members.fromContacts.toUpperCase()}
          </Text>
          <View style={styles.chips}>
            {pickable.map((contact) => (
              <Chip
                key={contact.id}
                size={44}
                avatar={memberName(contact)}
                label={memberName(contact)}
                selected={picked?.id === contact.id}
                disabled={busy}
                onPress={() => {
                  setUsername('');
                  setPicked(picked?.id === contact.id ? null : contact);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.road}>
        <Divider />
        <View style={styles.link}>
          <View style={styles.grow}>
            <Text role="rowSm">{s.members.inviteLink}</Text>

            <Text role="aside" tone="muted">
              {s.members.linkGrants(s.role[invite?.role ?? newcomerRole])}
            </Text>
          </View>
          {shareable === null ? (
            <Button
              variant="small"
              label={s.members.getLink}
              disabled={busy}
              style={styles.strong}
              onPress={() =>
                act(async (session) => {
                  setInvite(await fetchInvite(session, memoryId));
                  return null;
                })
              }
            />
          ) : (
            <Button
              variant="small"
              icon={Share2}
              label={s.action.share}
              onPress={() => void Share.share({ message: shareable.link }).catch(() => {})}
              disabled={busy}
              style={styles.strong}
            />
          )}
        </View>
      </View>

      {shareable === null ? null : (
        <Button
          size="xs"
          variant="quiet"
          label={s.members.replaceLink}
          disabled={busy}
          style={styles.quiet}
          onPress={() =>
            act(async (session) => {
              setInvite(await rotateInvite(session, memoryId, newcomerRole));
              return s.members.linkReplaced;
            })
          }
        />
      )}

      {notice ? <Banner failure={notice} /> : null}
    </Sheet>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    section: { gap: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
    quiet: { alignSelf: 'flex-start' },
    road: { gap: space.s4 },
    grow: { flex: 1, minWidth: '50%', gap: space.s1 },
    strong: { borderColor: color.lineStrong, paddingHorizontal: space.s4 },
    link: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s3 },
  }),
);
