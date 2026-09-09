import { useFocusEffect, useRouter } from 'expo-router';
import { Share2, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import {
  ApiError,
  addContact,
  errorMessage,
  fetchInvite,
  inviteByUsername,
  listContacts,
  listMedia,
  listMembers,
  mayContribute,
  memberHandle,
  memberName,
  removeMember,
  rotateInvite,
  setContributionStatus,
  type Contact,
  type Invite,
  type Member,
} from '@/api';
import { useAuth } from '@/auth';
import { formatEventDates } from '@/dates';
import {
  ActionBar,
  Banner,
  Button,
  Chip,
  ChipAction,
  ConfirmSheet,
  Empty,
  Field,
  IconButton,
  // The kit's `.invite` box. The api's own `Invite` is the token behind it and keeps the plain
  // name here, as it has everywhere else in the app.
  Invite as InviteLink,
  RowMember,
  Sheet,
  Status,
  Text,
  Toggle,
} from '@/kit';
import { useStrings } from '@/language';
import { MemoryHead, type Head } from '@/memory/head';
import { space } from '@/theme';

/**
 * The third face of a memory (kit, «Экраны» 6): who is in it and how to get more people in. What the
 * caller may do is read off their own row in the roster — the api is the authority on that, so
 * nothing here is gated on anything the client made up.
 *
 * Leaving a memory is not offered here (TASK-113): the api still takes it and the organizer's cross
 * still uses that same call to remove somebody else, but nobody is shown a way out of their own.
 *
 * Nothing on the right of the appbar: the kit gives that corner to the frames face alone, and the
 * material and the movies are one press away on the switch under the name.
 */
export function People({ id, head }: { id: string; head: Head }) {
  const { token, user } = useAuth();
  const router = useRouter();
  const s = useStrings();
  // null means «not loaded yet» — the same distinction the home screen draws, so a refetch
  // after an invite keeps the roster on screen instead of flashing the spinner over it.
  const [members, setMembers] = useState<Member[] | null>(null);
  // How many frames each person has brought, by their id. The api keeps no such tally on a member,
  // so it is counted off the memory's own gallery — the very listing the frames face reads. null is
  // «not counted yet», and the rows stand under a dash until it is.
  const [shots, setShots] = useState<Map<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [username, setUsername] = useState('');
  // The level newcomers get, by both roads at once: it is what an invite by username grants
  // and what a rotated link will grant, so there is one answer to «what does joining give».
  const [mayAdd, setMayAdd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Everything to do with getting people in is asked for on a sheet, not kept open on the face:
  // inviting is something one does once, and the roster is what this face is for.
  const [inviting, setInviting] = useState(false);
  // Who the confirm sheet is asking about; null is «no sheet». The sheet is the whole state:
  // holding a boolean beside the member would let the two disagree.
  const [dropping, setDropping] = useState<Member | null>(null);
  // The names this person invites from (doc-10), read when the sheet opens and not with the face:
  // whoever is not inviting has no use for the list, and every open catches whatever was saved on
  // the contacts screen since. null is «не спросили или не отдались» — either way, no block.
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  // The person just invited by typing their username, and whether they have been saved since. Only
  // that road leads here: picked out of the contacts, they are a contact already (kit, «Сохранить»).
  const [invited, setInvited] = useState<Member | null>(null);
  const [kept, setKept] = useState(false);
  // Which contact's «Позвать» is waiting on the server. Held by id rather than by the shared `busy`
  // so that one row spins and the rows around it stay live — «остальные строки не гаснут».
  const [calling, setCalling] = useState<string | null>(null);

  const memory = head.memory;

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    // The roster: the memory itself — the name in the appbar and the days under it — is read once
    // by the screen for all three faces, so switching between them re-reads only what changed.
    listMembers(token, id).then(setMembers, (e: unknown) => setError(errorMessage(e)));
    // And the gallery, only to be counted: two reads side by side rather than one `Promise.all`,
    // because the roster is what this face is, and the count is a fact beside it. A memory whose
    // media cannot be listed (503 with no bucket configured) still has to show who is in it, so
    // this failure leaves the dash and never the face's error line.
    //
    // A failure is swallowed and nothing is written: this runs again on every focus, and a read
    // that falls over on the way back from the upload screen used to blank a column of counts that
    // was already on screen and correct. Nothing on this face retries it — the banner belongs to
    // the roster — so it would have stood as dashes until the next focus. Never counted and
    // counted-then-lost are not the same thing, and only the first one is worth a dash.
    listMedia(token, id).then(
      (media) =>
        setShots(
          media.reduce(
            (by, item) => by.set(item.uploaded_by, (by.get(item.uploaded_by) ?? 0) + 1),
            new Map<string, number>(),
          ),
        ),
      () => {},
    );
  }, [token, id]);

  // On focus rather than on mount, the way the home screen does it: everybody's standing on the
  // roster changes while whoever is reading it is off uploading. Coming back re-reads it, instead
  // of leaving a face that has been stale since it was first opened.
  //
  // And the sheet is shut on the way out (TASK-94): leaving this face without closing it — a push,
  // a deep link, anything that is not the cross or the scrim — left the Modal mounted, so the
  // invite sheet stood over whatever screen came next. The cleanup `useFocusEffect` runs on blur is
  // where that belongs; every explicit close still goes through `setInviting(false)` as before.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => setInviting(false);
    }, [load]),
  );

  // Read on every open of the sheet, and nothing is done when it fails: «контакты не отдались — их
  // блока просто нет», the username field beside it still being the whole other road in.
  useEffect(() => {
    if (!inviting || !token) return;
    setInvited(null);
    listContacts(token).then(setContacts, () => {});
  }, [inviting, token]);

  const me = members?.find((member) => member.id === user?.id) ?? null;
  const role = me?.role ?? null;
  // doc-01: adding people is «Добавление» and up, and so is bringing photos — whoever may bring
  // material to a memory may bring people to it. A viewer may look and leave, nothing else. The
  // api is the authority on all of it; this only decides what to draw.
  const mayContributeHere = mayContribute(role);
  const newcomerRole = mayAdd ? 'contributor' : 'viewer';
  // Derived together so the branch below narrows both at once: there is a link exactly when
  // there is an invite. `remember://` is the scheme in app.json; TASK-16 is what receives it.
  const shareable = invite && {
    link: `remember://invite?token=${encodeURIComponent(invite.token)}`,
    grants: s.role[invite.role],
  };
  // Checked against `dropping` first, so a closed sheet is never «about me» by two undefineds.
  const leaving = dropping !== null && dropping.id === user?.id;
  // The one field is the sieve for both roads at once (kit, «Два пути»): what is typed narrows the
  // contacts under it, and a name none of them holds is still a name the button above can invite.
  // The @ and the capitals come off the same way the contacts screen takes them off.
  const needle = username.trim().replace(/^@+/, '').toLowerCase();
  // Whoever is already here drops out of the list — they are on the roster behind the sheet, and
  // offering to invite them again would be the sheet arguing with what is under it.
  const pickable = (contacts ?? []).filter(
    (contact) =>
      !members?.some((member) => member.id === contact.id) &&
      (needle === '' ||
        (contact.username ?? '').toLowerCase().includes(needle) ||
        (contact.name ?? '').toLowerCase().includes(needle)),
  );

  /**
   * Every api call this face's buttons make is the same shape: lock the controls, run one call,
   * say one line about it. `said` maps the statuses this particular call can come back with;
   * anything else falls through to the api's own wording.
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
        // Typed and not picked, so this is the one road onto the offer to keep them. Somebody
        // already on the contact list gets the same row with the chip already read as «В
        // контактах»: it is true, and offering to save them twice would not be.
        setInvited(added);
        setKept(contacts?.some((contact) => contact.id === added.id) ?? false);
        setUsername('');
        load();
        return already
          ? s.members.already(memberName(added), s.role[added.role])
          : s.members.added(memberName(added), s.role[added.role]);
      },
      { 404: s.members.noSuchUser, 403: s.members.inviteDenied },
    );

  /**
   * The other road in, and the first one on the sheet because it is the one taken most often: the
   * person is picked off the list and nothing is typed at all. Nothing is offered afterwards — they
   * are a contact already, which is how they came to be on that list.
   */
  const inviteContact = (contact: Contact) => {
    const handle = contact.username;
    if (!handle) return;
    setCalling(contact.id);
    void act(
      async (session) => {
        const added = await inviteByUsername(session, id, handle, newcomerRole);
        // The roster is what takes them out of the list under the field: one truth, read back from
        // the api, rather than the sheet crossing a name off on its own account.
        load();
        return s.members.added(memberName(added), s.role[added.role]);
      },
      { 403: s.members.inviteDenied },
    ).finally(() => setCalling(null));
  };

  /**
   * The chip on the row of somebody just invited by name. Outside `act`: it is nobody's answer to
   * the invite, and clearing the line that says «Добавили Рому» to say nothing in its place would
   * take away the very thing this chip is standing beside. Only a failure has anything to say.
   */
  const keep = (person: Member) => {
    const handle = person.username;
    if (!token || !handle) return;
    addContact(token, handle).then(
      (contact) => {
        setContacts((held) => [...(held ?? []), contact]);
        setKept(true);
      },
      (e: unknown) => setNotice(errorMessage(e)),
    );
  };

  const showLink = () =>
    act(async (session) => {
      setInvite(await fetchInvite(session, id));
      return null;
    });

  const rotate = () =>
    act(async (session) => {
      setInvite(await rotateInvite(session, id, newcomerRole));
      return s.members.linkReplaced;
    });

  /**
   * «Ждать нечего», said without uploading anything — doc-06's own path onto a terminal status
   * for the person who has no material at all. Only ever about oneself: the api takes no user id.
   */
  const sayNothing = () =>
    act(async (session) => {
      await setContributionStatus(session, id, 'nothing');
      load();
      return null;
    });

  const drop = (target: Member) =>
    act(
      async (session) => {
        await removeMember(session, id, target.id);
        if (target.id === user?.id) router.replace('/');
        else load();
        return null;
      },
      { 404: s.members.gone },
    );

  return (
    <>
      <MemoryHead {...head} />

      <ScrollView contentContainerStyle={styles.body}>
        {memory ? (
          <Text role="meta">{formatEventDates(memory.event_start, memory.event_end)}</Text>
        ) : null}

        {error !== null ? (
          <Banner tone="error" text={error}>
            <Button sm variant="quiet" label={s.action.retry} onPress={load} />
          </Banner>
        ) : members === null ? (
          <Empty busy text={s.state.loading} />
        ) : (
          <>
            {/* A section of the face, and the kit sets those in `.t-title` — its type specimen
                draws this very heading in it. Muted 13 is `.t-meta`, which is the voice of a fact
                beside a name, not of the heading over the whole roster. A heading to a rotor, too:
                under the memory's own name in the appbar, it is the second stop on the way down. */}
            <Text accessibilityRole="header" role="title">
              {s.members.roster}
            </Text>
            {/* A `.map` and not a FlatList: this is one event's guest list inside a ScrollView,
                and nesting a virtualised list in one is the thing React Native asks you not to do.
                One View around it all so the rows keep the kit's own hairline and padding instead of
                the gap this face puts between everything else. */}
            <View>
              {members.map((member, index) => {
                const self = member.id === user?.id;

                // Only on one's own row, and only while there is something left to say: both
                // terminal statuses are the person's own word, and this is the way to give it
                // unprompted. It stands in the status's own place (kit, «Экраны» 6, «Свой статус»),
                // because the standing and the switch that sets it are one thing, and a chip is
                // exactly as tall as the word it replaces — which is what keeps this row level with
                // the ones around it. It used to be a small button under the row and that is what
                // was reported: it pushed one row taller than the rest and the stack came out ragged
                // (TASK-111). Only for somebody who could have added something: doc-01 gives
                // «загружать медиа» to «Добавление» and up, so a viewer is a person nobody is
                // waiting on — asking them to declare «ждать нечего» asks them to answer for
                // material they were never able to bring. The api stays open to it on purpose (no
                // role gate there): a status grants nothing, and one already given must survive its
                // owner being moved down to viewer. This is the asking, not the right. The standing
                // itself is written on every row, viewer's included — the roster is the organizer's
                // progress and it is the same line for everybody.
                const mine =
                  self &&
                  mayContributeHere &&
                  member.contribution_status !== 'done' &&
                  member.contribution_status !== 'nothing';

                return (
                  <RowMember
                    key={member.id}
                    name={self ? s.members.you(memberName(member)) : memberName(member)}
                    meta={memberHandle(member)}
                    status={
                      mine ? (
                        <ChipAction
                          label={s.members.sayNothing}
                          onPress={sayNothing}
                          disabled={busy}
                        />
                      ) : (
                        <Status
                          text={s.standing[member.contribution_status]}
                          ready={member.contribution_status === 'done'}
                        />
                      )
                    }
                    // What they have brought so far, counted off the gallery. A dash until it is
                    // counted rather than a nought, which would be a different thing said out loud;
                    // either way the column is there from the first frame drawn, so the row does not
                    // jump when the count lands.
                    count={shots ? s.memory.frames(shots.get(member.id) ?? 0) : '—'}
                    divider={index > 0}
                  >
                    <Chip label={s.role[member.role]} organizer={member.role === 'organizer'} />
                    {/* The organizer's cross, drawn small so it stands inside a line of text
                        rather than over it. On the organizer's own row there is none — and the
                        kit holds that column open anyway, so the role chips of a stack that has
                        crosses stand at one depth instead of stepping in and out. */}
                    {role !== 'organizer' ? null : self ? (
                      <View style={styles.noCross} />
                    ) : (
                      <IconButton
                        sm
                        icon={X}
                        label={s.members.remove(memberName(member))}
                        onPress={() => setDropping(member)}
                        disabled={busy}
                      />
                    )}
                  </RowMember>
                );
              })}
            </View>
          </>
        )}

        {notice ? <Banner text={notice} /> : null}
      </ScrollView>

      {/* The kit's own footer for this face: the whole reason it exists is that there be more
          people in the memory. Behind the same level the api gates inviting on — a viewer is shown
          neither this nor the crosses (kit, «Экраны» 6, «Края»), and for them the face simply ends
          with the roster. */}
      {mayContributeHere ? (
        <View style={styles.pad}>
          <ActionBar>
            <Button
              variant="primary"
              wide
              label={s.action.invite}
              onPress={() => setInviting(true)}
              disabled={busy}
            />
          </ActionBar>
        </View>
      ) : null}

      {/* Both roads in, on one sheet: the level a newcomer arrives at is the same question for
          both, and it is asked once above them. `visible` and nothing else — the Modal drops its
          children while hidden, so each open starts the rise over. */}
      <Sheet visible={inviting} onCancel={() => setInviting(false)}>
        <Text accessibilityRole="header" role="title">
          {s.members.inviteTitle}
        </Text>
        {/* The kit has no switch of its own, so the platform's wears the kit's colours — once, in
            `kit/toggle.tsx`, rather than spelled out on every screen that needs one (TASK-56). */}
        <Toggle
          label={s.members.mayAdd}
          value={mayAdd}
          onValueChange={setMayAdd}
          disabled={busy}
        />
        <Field
          label={s.username.label}
          value={username}
          onChangeText={setUsername}
          placeholder={s.username.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />
        {/* The sheet's own one glowing button, the way the order sheet has «Смонтировать»: a
            surface gets exactly one, and here it is the whole point of opening this one. The link
            below is the other road in and stays a plain button — it hands over something to send,
            it does not put anybody in. */}
        <Button
          variant="primary"
          label={s.action.invite}
          onPress={sendInvite}
          disabled={busy || username.trim() === ''}
        />

        {/* Invited by name, and so the one person on this sheet who might be worth keeping. The
            offer sits on their own row, in the right end of it where a contact's «Позвать» stands
            — nothing rises over the sheet and nothing is asked (kit, «Экраны» 6, «Сохранить»).
            Pressed, the chip stays exactly where it is and reads «В контактах»; unpressed, it
            leaves with the sheet and was never in anybody's way. */}
        {invited !== null ? (
          <RowMember
            name={memberName(invited)}
            meta={memberHandle(invited)}
            status={<Status text={s.members.invited} />}
          >
            <ChipAction
              label={kept ? s.members.keptContact : s.members.keepContact}
              checked={kept}
              // Saved is a standing and not a switch: the way off a contact list is that list's
              // own cross, not a chip on a sheet that is about to close.
              onPress={kept ? undefined : () => keep(invited)}
            />
          </RowMember>
        ) : null}

        {/* The first road in, under the field that sieves it. Nobody left to offer — no contacts at
            all, or every one of them already here — and the block is not there: the sheet is then
            exactly what it was before contacts existed, never an empty list saying so. */}
        {pickable.length > 0 ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" role="label">
              {s.members.fromContacts}
            </Text>
            {/* `.picklist{max-height:216px}` — two rows and half of the third, scrolling inside
                itself so that a long list never grows the sheet up into the screen. */}
            <ScrollView style={styles.picklist}>
              {pickable.map((contact, index) => (
                <RowMember
                  key={contact.id}
                  name={memberName(contact)}
                  meta={memberHandle(contact)}
                  divider={index > 0}
                >
                  <Button
                    sm
                    label={s.members.inviteDo}
                    busy={calling === contact.id}
                    onPress={() => inviteContact(contact)}
                  />
                </RowMember>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text role="meta">{s.members.inviteLink}</Text>
        {shareable === null ? (
          // Asked for rather than loaded with the face: the api mints the link on this
          // very call, and a memory nobody shares should not carry one.
          <Button label={s.members.getLink} onPress={showLink} disabled={busy} />
        ) : (
          <>
            <InviteLink url={shareable.link}>
              {/* The platform's own share sheet, which is also the copy button — no
                  clipboard dependency for something every OS already does better. */}
              <Button
                sm
                icon={Share2}
                label={s.action.share}
                onPress={() => void Share.share({ message: shareable.link }).catch(() => {})}
                disabled={busy}
              />
            </InviteLink>
            <Text role="meta">{s.members.linkGrants(shareable.grants)}</Text>
            {/* Section 11: replacing a link is a quiet thing beside it, not a red button. */}
            <Button
              sm
              variant="quiet"
              label={s.members.replaceLink}
              onPress={rotate}
              disabled={busy}
              style={styles.quiet}
            />
          </>
        )}
        {/* The same notice as the one on the face, because half of what it says is said in
            answer to something pressed in here — and the face's copy is under the scrim. */}
        {notice ? <Banner text={notice} /> : null}
      </Sheet>

      {/* Both halves of the same act, and irreversible either way — doc-01 takes the media too.
          Section 13: what cannot be undone is asked on a sheet that names what will be lost, and
          the button repeats the verb of the question. */}
      {dropping !== null ? (
        <ConfirmSheet
          visible
          title={leaving ? s.members.leaveAsk : s.members.removeAsk(memberName(dropping))}
          text={leaving ? s.members.leaveText : s.members.removeText}
          confirmLabel={leaving ? s.members.leaveDo : s.members.removeDo}
          cancelLabel={leaving ? s.members.stay : s.members.keepThem}
          onConfirm={() => {
            const target = dropping;
            setDropping(null);
            void drop(target);
          }}
          onCancel={() => setDropping(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // The kit's 16 at the sides, the same the head above keeps, and a tail under the last row so it
  // does not end against the bar.
  body: { paddingHorizontal: space.s4, paddingBottom: space.s8, gap: space.s3 },
  pad: { paddingHorizontal: space.s4 },
  // `.stack-2` — the rule and the list it introduces, the way the contacts screen sets the same
  // pair. The list itself is the kit's `.picklist`, cut where the third row is half read.
  section: { gap: space.s2 },
  picklist: { maxHeight: 216 },
  // The kit's `minmax(28px,auto)` last column, kept open where there is no cross to put in it.
  noCross: { width: 28 },
  quiet: { alignSelf: 'flex-start' },
});
