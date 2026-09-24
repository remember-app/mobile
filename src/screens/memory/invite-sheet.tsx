import { Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import {
  ApiError,
  errorMessage,
  fetchInvite,
  inviteByUsername,
  listContacts,
  memberName,
  rotateInvite,
  type Contact,
  type Invite,
  type Member,
} from '@/api';
import { useAuth } from '@/lib/auth';
import { matches, useFindUser } from '@/lib/find-user';
import { Banner, Button, Chip, Divider, Field, Sheet, Text, Toggle } from '@/kit';
import { useStrings } from '@/lib/language';
import { space, themed } from '@/theme';

/**
 * `SheetInvite` (spec 8) — both roads into a memory on one sheet: the username of somebody whose
 * name is known, the chips of people already saved, and the link for whoever has neither. The level
 * a newcomer arrives at is the same question for all of them and is asked once, above the lot.
 *
 * Its own file and not part of the screen that raises it: the settings screen has a footer button
 * for it and the layout hangs it off a freshly created memory too, and a second copy of a sheet
 * that mints links is two answers to «кого и как зовут».
 *
 * `visible` and nothing else keeps it up — the Modal under it drops its children while hidden, so
 * every open starts the rise over and no state survives a close.
 */
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
  /** The roster behind the scrim: whoever is on it is neither offered nor asked about. */
  members: Member[] | null;
  /** Somebody came in — the roster underneath is read back from the api rather than patched here. */
  onInvited: () => void;
}) {
  const { token, user } = useAuth();
  const s = useStrings();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [username, setUsername] = useState('');
  // The level newcomers get, by both roads at once: it is what an invite by username grants and what
  // a rotated link will grant, so there is one answer to «what does joining give».
  const [mayAdd, setMayAdd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // The names this person invites from (doc-10), read when the sheet opens and not with the screen:
  // whoever is not inviting has no use for the list, and every open catches whatever was saved on
  // the contacts screen since. null is «не спросили или не отдались» — either way, no block.
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  // The contact whose chip is pressed in. One at a time: the api takes one name per call, and the
  // sheet's own button is what sends it.
  const [picked, setPicked] = useState<Contact | null>(null);

  // Read on every open, and nothing is done when it fails: «контакты не отдались — их блока просто
  // нет», the username field beside it still being the whole other road in.
  useEffect(() => {
    if (!visible || !token) return;
    setPicked(null);
    listContacts(token).then(setContacts, () => {});
  }, [visible, token]);

  const newcomerRole = mayAdd ? 'contributor' : 'viewer';
  // Derived together so the branch below narrows both at once: there is a link exactly when there is
  // an invite. `remember://` is the scheme in app.json; TASK-16 is what receives it.
  const shareable = invite && {
    link: `remember://invite?token=${encodeURIComponent(invite.token)}`,
    grants: s.role[invite.role],
  };
  // The one field is the sieve, and there is no second one on the sheet (spec 8): what is typed
  // narrows the contacts under it, and a name none of them holds is asked of the api. The @ and the
  // capitals come off the same way the contacts screen takes them off.
  const query = username.trim().replace(/^@+/, '');
  const needle = query.toLowerCase();
  // Whoever is already here drops out of the chips — they are on the roster behind the sheet, and
  // offering to invite them again would be the sheet arguing with what is under it.
  const pickable = (contacts ?? []).filter(
    (contact) => !members?.some((member) => member.id === contact.id) && matches(contact, needle),
  );
  // The one on the roster who already holds the typed name. The sheet is a Modal with a scrim over
  // that roster, so «этот уже здесь» has nowhere else to be said: without the line below, a name
  // that is right behind the sheet drops out of the contacts, is not asked about, and answers with
  // nothing at all — an empty sheet under a field with a correct nick in it.
  const here = (members ?? []).find((member) => member.username?.toLowerCase() === needle);
  // An exact name that is already answered on this sheet — a contact among the chips, or somebody on
  // the roster behind it — is not asked about: the answer is on screen, and a second lookup for the
  // same person would offer to invite whoever the list has just dropped for being here already.
  const answered =
    here !== undefined ||
    (contacts ?? []).some((contact) => contact.username?.toLowerCase() === needle);
  // The field's second answer (spec 8, «ник не найден → ошибка под полем»): a name none of the
  // contacts holds is asked of the api, and the answer is what the button below sends to. The same
  // lookup the contacts screen reads, from the one place both of them keep it (`@/lib/find-user`) —
  // yourself is nobody to offer, being on this roster already.
  const { found, looking } = useFindUser(token, query, { skip: !visible || answered, selfId: user?.id });
  // Who «Позвать» will call: the contact whose chip is pressed in, or — with no chip pressed — the
  // person the typed name stands for. Never both at once: typing lets the chip go, and a chip empties
  // the field. A name the contacts already hold is answered off that list rather than by the api,
  // which is never asked about it (`answered`) — typing somebody's nick in full does what pressing
  // their chip does. Somebody already on the roster is nobody to send to: the field says so.
  const saved = (contacts ?? []).find((contact) => contact.username?.toLowerCase() === needle);
  const target = here ? null : (picked ?? saved ?? (found === 'none' ? null : found));

  /**
   * Every api call this sheet makes is the same shape: lock the controls, run one call, say one line
   * about it. `said` maps the statuses this particular call can come back with; anything else falls
   * through to the api's own wording.
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

  /**
   * Both roads end here — the chip and the typed nick — because the level a newcomer arrives at is
   * the same question for both and is asked once, above them, on the switch.
   */
  const sendInvite = (person: Contact) => {
    const handle = person.username;
    // One at a time: `act` holds one `busy` and one `notice` for the whole sheet, so a second press
    // under the first would unlock the field mid-flight and let whichever answer landed last be read
    // as the answer to the last press.
    if (!handle || busy) return;
    void act(
      async (session) => {
        const added = await inviteByUsername(session, memoryId, handle, newcomerRole);
        // The api is idempotent and answers 200 either way, so a re-add is only visible against the
        // roster as it stood before the call.
        const already = members?.some((member) => member.id === added.id) ?? false;
        // The sheet is emptied of who it was about: the roster behind it is what says they are in.
        setUsername('');
        setPicked(null);
        onInvited();
        return already
          ? s.members.already(memberName(added), s.role[added.role])
          : s.members.added(memberName(added), s.role[added.role]);
      },
      { 403: s.members.inviteDenied },
    );
  };

  const styles = useStyles();

  return (
    <Sheet
      visible={visible}
      onCancel={onCancel}
      title={s.members.inviteTitle}
      scroll
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
      {/* The field carries no visible label — the sheet's own heading is over it and the `@` in front
          says what goes in — but keeps one for a screen reader (spec 7.9). */}
      <Field
        label={s.username.label}
        labelHidden
        variant="handle"
        // The sheet under it is already `surface`, so the field itself stands on `ink` (spec 7.3).
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
        // The check is answered in the field itself: «Никто не носит такой ник» under it, and for
        // somebody already on the roster the plain fact that they are — not an error, and nowhere
        // else to say it, since that roster is behind the scrim.
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

      {/* The kit has no switch of its own, so the platform's wears the kit's colours — once, in
          `kit/toggle.tsx`, rather than spelled out on every screen that needs one (TASK-56). */}
      <Toggle label={s.members.mayAdd} value={mayAdd} onValueChange={setMayAdd} disabled={busy} />

      {/* The first road in, sieved by the field above it. Nobody left to offer — no contacts at all,
          or every one of them already here — and the block is not there: the sheet is then exactly
          what it was before contacts existed, never an empty list saying so. */}
      {pickable.length > 0 ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" role="eyebrow">
            {s.members.fromContacts.toUpperCase()}
          </Text>
          <View style={styles.chips}>
            {pickable.map((contact) => (
              <Chip
                key={contact.id}
                avatar={memberName(contact)}
                label={memberName(contact)}
                selected={picked?.id === contact.id}
                disabled={busy}
                onPress={() => {
                  // A chip and the field are one slot: pressing one lets go of the other, so the
                  // button below can never be about two people at once.
                  setUsername('');
                  setPicked(picked?.id === contact.id ? null : contact);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* The other road, for whoever's nick nobody knows — under a rule of its own, the way the
          layout separates it from the two above. */}
      <Divider />
      <View style={styles.link}>
        <View style={styles.grow}>
          <Text role="row">{s.members.inviteLink}</Text>
          {/* What following it will grant: the link's own level once there is one, and until then
              the level the switch above is set to — which is what a fresh link would carry. */}
          <Text role="note">{s.members.linkGrants(s.role[invite?.role ?? newcomerRole])}</Text>
        </View>
        {shareable === null ? (
          // Asked for rather than loaded with the sheet: the api mints the link on this very call,
          // and a memory nobody shares should not carry one.
          <Button
            variant="small"
            label={s.members.getLink}
            disabled={busy}
            onPress={() =>
              act(async (session) => {
                setInvite(await fetchInvite(session, memoryId));
                return null;
              })
            }
          />
        ) : (
          // The platform's own share sheet, which is also the copy button — no clipboard dependency
          // for something every OS already does better.
          <Button
            variant="small"
            icon={Share2}
            label={s.action.share}
            onPress={() => void Share.share({ message: shareable.link }).catch(() => {})}
            disabled={busy}
          />
        )}
      </View>
      {/* Replacing a link is a quiet thing beside it, not a red button — and there is nothing to
          replace until one has been asked for. */}
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

      {notice ? <Banner text={notice} /> : null}
    </Sheet>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    // A rule and the block it introduces, the way the contacts screen sets the same pair.
    section: { gap: space.s2 },
    // Spec 7.3: chips lie in a row that wraps, 8 apart.
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
    quiet: { alignSelf: 'flex-start' },
    grow: { flex: 1, minWidth: 0 },
    // The link and what the sheet offers to do with it, side by side.
    link: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  }),
);
