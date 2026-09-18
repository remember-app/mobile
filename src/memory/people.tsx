import { useFocusEffect, useRouter } from 'expo-router';
import { Pencil, Share2, UserPlus, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import {
  ApiError,
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
import { matches, useFindUser } from '@/find-user';
import {
  ActionBar,
  Banner,
  Button,
  Chip,
  BadgeContribution,
  BadgeOrganizer,
  ConfirmSheet,
  Divider,
  Empty,
  Field,
  IconButton,
  RowMember,
  Sheet,
  Text,
  Toggle,
} from '@/kit';
import { useStrings } from '@/language';
import { MemoryHead, type Head } from '@/memory/head';
import { space } from '@/theme';

/**
 * The third face of a memory (spec 8, `MemoryPeople`): who is in it, how much each of them has
 * brought, and how to get more people in. What the caller may do is read off their own row in the
 * roster — the api is the authority on that, so nothing here is gated on anything the client made up.
 *
 * Taking somebody out lives behind «Править состав» and not behind a cross that is always ready
 * (layout, `MemoryPeople`): an irreversible act is entered on purpose, and what it costs is named in
 * figures on the sheet that asks (`SheetConfirmMember`).
 *
 * Leaving a memory is not offered here (TASK-113): the api still takes it and the organizer's cross
 * still uses that same call to remove somebody else, but nobody is shown a way out of their own.
 *
 * Nothing on the right of the appbar: the layout gives that corner to the frames face alone, and the
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
  // Whether the roster is being edited. The crosses live in here and nowhere else — «своя кнопка, а
  // не крестик, который всегда наготове» — so an ordinary look at who is here cannot take anybody
  // out by a misplaced finger.
  const [editing, setEditing] = useState(false);
  // Who the confirm sheet is asking about; null is «no sheet». The sheet is the whole state:
  // holding a boolean beside the member would let the two disagree.
  const [dropping, setDropping] = useState<Member | null>(null);
  // The names this person invites from (doc-10), read when the sheet opens and not with the face:
  // whoever is not inviting has no use for the list, and every open catches whatever was saved on
  // the contacts screen since. null is «не спросили или не отдались» — either way, no block.
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  // The contact whose chip is pressed in. One at a time: the api takes one name per call, and the
  // sheet's own button is what sends it.
  const [picked, setPicked] = useState<Contact | null>(null);

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
  // The read and nothing else: shutting the invite sheet on the way out (TASK-94) was a line here
  // until TASK-129 moved it into the kit's own `Sheet`, which now does that for every sheet in the
  // app — this face's invite and the confirmation below it included.
  useFocusEffect(load);

  // Read on every open of the sheet, and nothing is done when it fails: «контакты не отдались — их
  // блока просто нет», the username field beside it still being the whole other road in.
  useEffect(() => {
    if (!inviting || !token) return;
    setPicked(null);
    listContacts(token).then(setContacts, () => {});
  }, [inviting, token]);

  const me = members?.find((member) => member.id === user?.id) ?? null;
  const role = me?.role ?? null;
  // doc-01: adding people is «Добавление» and up, and so is bringing photos — whoever may bring
  // material to a memory may bring people to it. A viewer may look and leave, nothing else. The
  // api is the authority on all of it; this only decides what to draw.
  const mayContributeHere = mayContribute(role);
  const newcomerRole = mayAdd ? 'contributor' : 'viewer';
  // «6 человек · 7 из 9 скинули» — the line under the heading, and the organizer's whole progress.
  // Counted over the people who can actually bring something (doc-01: «Добавление» and up), because
  // a viewer is nobody anybody is waiting on.
  const bringers = (members ?? []).filter((member) => mayContribute(member.role));
  const brought = bringers.filter((member) => member.contribution_status === 'done').length;
  // Derived together so the branch below narrows both at once: there is a link exactly when
  // there is an invite. `remember://` is the scheme in app.json; TASK-16 is what receives it.
  const shareable = invite && {
    link: `remember://invite?token=${encodeURIComponent(invite.token)}`,
    grants: s.role[invite.role],
  };
  // Checked against `dropping` first, so a closed sheet is never «about me» by two undefineds.
  const leaving = dropping !== null && dropping.id === user?.id;
  // What that person has brought, which is the price of taking them out — and nothing at all until
  // the gallery has been counted, because a plate saying «0 кадров исчезнут» names no price.
  const dropCost = dropping === null || shots === null ? null : (shots.get(dropping.id) ?? 0);
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
  // An exact name that is already answered on this sheet — a contact among the chips, or somebody
  // on the roster behind it — is not asked about: the answer is on screen, and a second lookup for
  // the same person would offer to invite whoever the list has just dropped for being here already.
  const answered =
    here !== undefined ||
    (contacts ?? []).some((contact) => contact.username?.toLowerCase() === needle);
  // The field's second answer (spec 8, «ник не найден → ошибка под полем»): a name none of the
  // contacts holds is asked of the api, and the answer is what the button below sends to. The same
  // lookup the contacts screen reads, from the one place both of them keep it (`@/find-user`) —
  // yourself is nobody to offer, being on this roster already.
  const { found, looking } = useFindUser(token, query, {
    skip: !inviting || answered,
    selfId: user?.id,
  });
  // Who «Позвать» will call: the contact whose chip is pressed in, or — with no chip pressed — the
  // person the typed name stands for. Never both at once: typing lets the chip go, and a chip
  // empties the field. A name the contacts already hold is answered off that list rather than by the
  // api, which is never asked about it (`answered`) — typing somebody's nick in full does what
  // pressing their chip does. Somebody already on the roster is nobody to send to: the field says so.
  const saved = (contacts ?? []).find((contact) => contact.username?.toLowerCase() === needle);
  const target = here ? null : (picked ?? saved ?? (found === 'none' ? null : found));

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

  /**
   * Both roads end here — the chip and the typed nick — because the level a newcomer arrives at is
   * the same question for both and is asked once, above them, on the switch.
   */
  const sendInvite = (person: Contact) => {
    const handle = person.username;
    // One at a time: `act` holds one `busy` and one `notice` for the whole sheet, so a second press
    // under the first would unlock the field mid-flight and let whichever answer landed last be
    // read as the answer to the last press.
    if (!handle || busy) return;
    void act(
      async (session) => {
        const added = await inviteByUsername(session, id, handle, newcomerRole);
        // The api is idempotent and answers 200 either way, so a re-add is only visible
        // against the roster as it stood before the call.
        const already = members?.some((member) => member.id === added.id) ?? false;
        // The sheet is emptied of who it was about: the roster behind it is what says they are in.
        setUsername('');
        setPicked(null);
        // And that roster is read back from the api rather than crossed off here on the sheet's own
        // account — one truth, which is also what takes them out of the chips.
        load();
        return already
          ? s.members.already(memberName(added), s.role[added.role])
          : s.members.added(memberName(added), s.role[added.role]);
      },
      { 403: s.members.inviteDenied },
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
        {error !== null ? (
          <Banner tone="error" text={error}>
            <Button size="xs" variant="quiet" label={s.action.retry} onPress={load} />
          </Banner>
        ) : members === null ? (
          <View style={styles.middle}>
            <Empty busy text={s.state.loading} />
          </View>
        ) : (
          <>
            {/* The head of the roster (spec 8): what the list is, how far it has got, and — for the
                organizer — the way into editing it. A section's heading is `title`; the line under
                it is the count of people and the count of those who have brought their frames, which
                is the one number the organizer opens this face for. */}
            <View style={styles.roster}>
              <View style={styles.grow}>
                <Text accessibilityRole="header" role="title">
                  {s.members.roster}
                </Text>
                <Text role="meta">
                  {s.memory.people(members.length)} ·{' '}
                  {s.members.brought(brought, bringers.length)}
                </Text>
              </View>
              {role === 'organizer' ? (
                <Button
                  variant="small"
                  icon={Pencil}
                  label={editing ? s.members.editDone : s.members.edit}
                  onPress={() => setEditing((was) => !was)}
                  disabled={busy}
                />
              ) : null}
            </View>

            {/* A `.map` and not a FlatList: this is one event's guest list inside a ScrollView,
                and nesting a virtualised list in one is the thing React Native asks you not to do.
                One View around it all so the rows keep the kit's own hairline and padding instead of
                the gap this face puts between everything else. */}
            <View>
              {members.map((member, index) => {
                const self = member.id === user?.id;

                // Only on one's own row, and only while there is something left to say: both
                // terminal statuses are the person's own word, and this is the way to give it
                // unprompted. It stands in the status's own place (spec 8, «Свой статус»), because
                // the standing and the switch that sets it are one thing, and a chip is exactly as
                // tall as the word it replaces — which is what keeps this row level with the ones
                // around it. It used to be a small button under the row and that is what was
                // reported: it pushed one row taller than the rest and the stack came out ragged
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
                    // Spec 7.5 writes the second line as «@ник · роль · N кадров», and the role in
                    // it is «Добавление» or «Просмотр» — never «Организатор», which is the badge
                    // beside the name and would be the same word twice in one row. A dash until the
                    // gallery is counted rather than a nought, which would be a different thing said
                    // out loud; either way the line is there from the first frame drawn, so the row
                    // does not jump when the count lands.
                    meta={[
                      memberHandle(member),
                      member.role === 'organizer' ? null : s.role[member.role],
                      shots ? s.memory.frames(shots.get(member.id) ?? 0) : '—',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    ring={member.role === 'organizer'}
                    badge={
                      member.role === 'organizer' ? (
                        <BadgeOrganizer label={s.role[member.role]} sm />
                      ) : null
                    }
                    status={
                      mine ? (
                        <Chip label={s.members.sayNothing} onPress={sayNothing} disabled={busy} />
                      ) : (
                        <BadgeContribution
                          state={
                            member.contribution_status === 'done'
                              ? 'done'
                              : member.contribution_status === 'nothing'
                                ? 'nothing'
                                : 'planned'
                          }
                          label={s.standing[member.contribution_status]}
                        />
                      )
                    }
                    divider={index > 0}
                  >
                    {/* The cross of the editing mode, drawn small so it stands inside a line of
                        text rather than over it. On the organizer's own row there is none — and the
                        column is held open anyway, so the marks of a stack that has crosses stand at
                        one depth instead of stepping in and out. */}
                    {!editing || role !== 'organizer' ? null : self ? (
                      <View style={styles.noCross} />
                    ) : (
                      <IconButton
                        size={36}
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

      {/* The one glowing action of this face: the whole reason it exists is that there be more
          people in the memory. Behind the same level the api gates inviting on — a viewer is shown
          neither this nor the crosses, and for them the face simply ends with the roster. */}
      {mayContributeHere ? (
        <ActionBar>
          <Button
            variant="primary"
            wide
            icon={UserPlus}
            label={s.action.invite}
            onPress={() => setInviting(true)}
            disabled={busy}
          />
        </ActionBar>
      ) : null}

      {/* `SheetInvite`, both roads in on one sheet: the nick of somebody whose name is known, the
          chips of people already saved, and the link for whoever has neither. The level a newcomer
          arrives at is the same question for all of them and is asked once, above. `visible` and
          nothing else — the Modal drops its children while hidden, so each open starts the rise
          over. */}
      <Sheet
        visible={inviting}
        onCancel={() => setInviting(false)}
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
        {/* The field carries no visible label — the sheet's own heading is over it and the `@` in
            front says what goes in — but keeps one for a screen reader (spec 7.9). */}
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

        {/* The first road in, sieved by the field above it. Nobody left to offer — no contacts at
            all, or every one of them already here — and the block is not there: the sheet is then
            exactly what it was before contacts existed, never an empty list saying so. */}
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
            // Asked for rather than loaded with the face: the api mints the link on this very call,
            // and a memory nobody shares should not carry one.
            <Button variant="small" label={s.members.getLink} onPress={showLink} disabled={busy} />
          ) : (
            // The platform's own share sheet, which is also the copy button — no clipboard
            // dependency for something every OS already does better.
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
            onPress={rotate}
            disabled={busy}
            style={styles.quiet}
          />
        )}

        {/* The same notice as the one on the face, because half of what it says is said in
            answer to something pressed in here — and the face's copy is under the scrim. */}
        {notice ? <Banner text={notice} /> : null}
      </Sheet>

      {/* `SheetConfirmMember` — irreversible, and doc-01 takes the material with the person. So the
          sheet carries their face, what they brought, and the price in figures before the press;
          the button repeats the verb of the question. */}
      {dropping !== null ? (
        <ConfirmSheet
          visible
          who={memberName(dropping)}
          meta={[memberHandle(dropping), dropCost === null ? null : s.memory.frames(dropCost)]
            .filter(Boolean)
            .join(' · ')}
          price={dropCost ? s.members.priceFrames(dropCost) : undefined}
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
  // The kit's 16 at the sides, the same the head above keeps — the bar below draws its own, so
  // nothing here wraps it in a second copy.
  body: { flexGrow: 1, paddingHorizontal: space.s4, paddingBottom: space.s6, gap: space.s3 },
  // Waiting holds the place of the roster in the middle of the body rather than blinking at the top.
  middle: { flex: 1, justifyContent: 'center' },
  // The heading, its count, and the way into editing — one line, the button never shrinking.
  roster: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingBottom: space.s1 },
  grow: { flex: 1, minWidth: 0 },
  // A rule and the block it introduces, the way the contacts screen sets the same pair.
  section: { gap: space.s2 },
  // Spec 7.3: chips lie in a row that wraps, 8 apart.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  // The kit's `minmax(28px,auto)` last column, kept open where there is no cross to put in it.
  noCross: { width: 28 },
  quiet: { alignSelf: 'flex-start' },
  // The link and what the sheet offers to do with it, side by side.
  link: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
});
