import { useFocusEffect, useRouter } from 'expo-router';
import { Check, Share2, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import {
  ApiError,
  errorMessage,
  fetchInvite,
  inviteByUsername,
  listMembers,
  mayContribute,
  memberName,
  removeMember,
  rotateInvite,
  setContributionStatus,
  type Invite,
  type Member,
} from '@/api';
import { useAuth } from '@/auth';
import { formatEventDates } from '@/dates';
import {
  ActionBar,
  AVATAR,
  Banner,
  Button,
  Chip,
  ConfirmSheet,
  Empty,
  Field,
  ICO_S,
  IconButton,
  // The kit's `.invite` box. The api's own `Invite` is the token behind it and keeps the plain
  // name here, as it has everywhere else in the app.
  Invite as InviteLink,
  RowMember,
  Sheet,
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

  const memory = head.memory;

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    // The roster alone: the memory itself — the name in the appbar and the days under it — is read
    // once by the screen for all three faces, so switching between them re-reads only what changed.
    listMembers(token, id).then(setMembers, (e: unknown) => setError(errorMessage(e)));
  }, [token, id]);

  // On focus rather than on mount, the way the home screen does it: everybody's standing on the
  // roster changes while whoever is reading it is off uploading. Coming back re-reads it, instead
  // of leaving a face that has been stale since it was first opened.
  useFocusEffect(load);

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
        setUsername('');
        load();
        return already
          ? s.members.already(memberName(added), s.role[added.role])
          : s.members.added(memberName(added), s.role[added.role]);
      },
      { 404: s.members.noSuchUser, 403: s.members.inviteDenied },
    );

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

                return (
                  <View key={member.id}>
                    <RowMember
                      name={self ? s.members.you(memberName(member)) : memberName(member)}
                      // Section 7 writes «@marina · 42 кадра» on one line, so the standing goes
                      // beside the username rather than under it. The wording is doc-06's own, and
                      // it goes in as the tail: on a phone the two together outrun the row, and of
                      // the pair it is the standing the roster is opened for.
                      // The username is left off when it is already the name on the line above —
                      // everybody who signed in by email is named by their username, and printing
                      // it twice spends the one line the standing needs on nothing.
                      meta={
                        member.username && member.username !== memberName(member)
                          ? `@${member.username}`
                          : undefined
                      }
                      tail={s.standing[member.contribution_status]}
                      divider={index > 0}
                    >
                      <Chip label={s.role[member.role]} organizer={member.role === 'organizer'} />
                      {role === 'organizer' && !self ? (
                        <IconButton
                          icon={X}
                          size={ICO_S}
                          label={s.members.remove(memberName(member))}
                          onPress={() => setDropping(member)}
                          disabled={busy}
                        />
                      ) : null}
                    </RowMember>
                    {/* Only on one's own row, and only while there is something left to say: both
                        terminal statuses are the person's own word, and this is the way to give it
                        unprompted. Under the row and not in it — the row already carries an avatar,
                        a name and a role chip, and a fourth thing on that line leaves the name no
                        width at all on a phone. Under the name, though, and not out at the right
                        edge: right-aligned it hung over the hairline and read as the next person's,
                        while in the name's own column there is no mistaking whose word it is. The
                        tick is what keeps it from being read as one more standing printed under the
                        row — a pill this size with no icon in it is the shape of the role chip.
                        And only for somebody who could have added something: doc-01 gives «загружать
                        медиа» to «Добавление» and up, so a viewer is a person nobody is waiting on —
                        asking them to declare «ждать нечего» asks them to answer for material they
                        were never able to bring. The api stays open to it on purpose (no role gate
                        there): a status grants nothing, and one already given must survive its owner
                        being moved down to viewer. This is the asking, not the right. The standing
                        itself stays on every row, viewer's included — the roster is the organizer's
                        progress and it is the same line for everybody. */}
                    {self &&
                    mayContributeHere &&
                    member.contribution_status !== 'done' &&
                    member.contribution_status !== 'nothing' ? (
                      <Button
                        sm
                        icon={Check}
                        label={s.members.sayNothing}
                        onPress={sayNothing}
                        disabled={busy}
                        style={styles.own}
                      />
                    ) : null}
                  </View>
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
  // Indented past the avatar so it starts where its own name does, and given the row's own bottom
  // padding so the hairline under it separates two people rather than a person from their button.
  own: { alignSelf: 'flex-start', marginLeft: AVATAR + space.s3, marginBottom: space.s3 },
  quiet: { alignSelf: 'flex-start' },
});
