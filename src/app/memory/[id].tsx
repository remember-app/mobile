import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Film, Share2, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  errorMessage,
  fetchInvite,
  inviteByUsername,
  listMemories,
  listMembers,
  mayContribute,
  memberName,
  removeMember,
  rotateInvite,
  setContributionStatus,
  type Invite,
  type Member,
  type Memory,
} from '@/api';
import { useAuth } from '@/auth';
import { formatEventDates } from '@/dates';
import {
  AppBar,
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
} from '@/kit';
import { useStrings } from '@/language';
import { color, space } from '@/theme';

/**
 * One memory: who is in it, how to get more people in, and how to get out. What the caller
 * may do is read off their own row in the roster — the api is the authority on that, so
 * nothing here is gated on anything the client made up.
 *
 * The videos are not here: they are their own screen, an icon away in the corner (TASK-64). Nor is
 * a way to add material — the gallery's «Add more» is where that lives, in front of what is
 * already in.
 */
export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const insets = useSafeAreaInsets();
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
  // Everything to do with getting people in is asked for on a sheet, not kept open on the screen:
  // inviting is something one does once, and the roster is what the screen is for.
  const [inviting, setInviting] = useState(false);
  // Who the confirm sheet is asking about; null is «no sheet». The sheet is the whole state:
  // holding a boolean beside the member would let the two disagree.
  const [dropping, setDropping] = useState<Member | null>(null);

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

  // On focus rather than on mount, the way the home screen does it: both things this screen says
  // about the material — the count on the gallery button and everybody's standing on the roster —
  // change while whoever is reading them is off uploading. Coming back re-reads them, instead of
  // leaving a screen that has been stale since it was first opened.
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
   * Every api call this screen's buttons make is the same shape: lock the controls, run one call,
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
    <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top }]}>
      <AppBar
        title={memory?.title ?? s.members.fallbackTitle}
        left={
          <IconButton
            icon={ChevronLeft}
            label={s.action.back}
            // A tapped invite push opens this screen with nothing behind it to go back to.
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        }
        right={
          // The other half of the memory, one icon away — the same corner, and the same idiom, the
          // gallery reaches this screen by. `Film` because what is behind it is the videos and the
          // making of them. `navigate` and not `push`: the two screens point at each other, and
          // pushing would stack a fresh copy of one over the other on every hop.
          <IconButton
            icon={Film}
            label={s.montage.title}
            onPress={() => router.navigate({ pathname: '/memory/[id]/montage', params: { id } })}
          />
        }
      />
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
          {/* Behind no role at all: looking at the material is what every member may do, a viewer
              included (doc-01). The count is the memory's own, so it says «empty» before opening.
              The kit gives the glow to exactly one thing per screen, and here that is the way to
              the material — the only thing everybody on this screen has come for. Adding to it is
              not offered here at all any more: «Add more» stands in the gallery, in front of what
              is already in. */}
          <Button
            variant="primary"
            label={memory ? s.members.material(memory.media_count) : s.members.materialPlain}
            onPress={() => router.push({ pathname: '/memory/[id]/gallery', params: { id } })}
          />

          {/* The whole of getting someone in, behind one button of the same size as the one above
              it — it belongs with the actions, and it stands right over the roster it adds to. */}
          {mayContributeHere ? (
            <Button label={s.action.invite} onPress={() => setInviting(true)} />
          ) : null}

          <Text role="meta" style={styles.section}>
            {s.members.roster}
          </Text>
          {/* A `.map` and not a FlatList: this is one event's guest list inside a ScrollView,
              and nesting a virtualised list in one is the thing React Native asks you not to do.
              One View around it all so the rows keep the kit's own hairline and padding instead of
              the gap this screen puts between everything else. */}
          <View>
            {members.map((member, index) => {
              const self = member.id === user?.id;

              return (
                <View key={member.id}>
                  <RowMember
                    name={self ? s.members.you(memberName(member)) : memberName(member)}
                    // Section 7 writes «@marina · 42 кадра» on one line, so the standing goes
                    // beside the username rather than under it. The wording is doc-06's own.
                    meta={[
                      member.username && `@${member.username}`,
                      s.standing[member.contribution_status],
                    ]
                      .filter(Boolean)
                      .join(' · ')}
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
                      width at all on a phone.
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

          {/* The organizer has no way out: leaving would leave the memory with nobody able to
              run it, and handing the role over is out of MVP (doc-01). The api says 409. */}
          {role !== null && role !== 'organizer' ? (
            <>
              <View style={styles.gap} />
              <Button
                variant="danger"
                label={s.members.leave}
                onPress={() => me && setDropping(me)}
                disabled={busy}
              />
            </>
          ) : null}
        </>
      )}

      {notice ? <Banner text={notice} /> : null}

      {/* Both roads in, on one sheet: the level a newcomer arrives at is the same question for
          both, and it is asked once above them. `visible` and nothing else — the Modal drops its
          children while hidden, so each open starts the rise over. */}
      <Sheet visible={inviting} onCancel={() => setInviting(false)}>
        <Text accessibilityRole="header" role="title">
          {s.members.inviteTitle}
        </Text>
        <View style={styles.toggle}>
          <Text role="label">{s.members.mayAdd}</Text>
          {/* The kit has no switch of its own, so the platform's takes the kit's colours. */}
          <Switch
            // Its own name, because the label beside it is only a sibling — and this one
            // decides whether a newcomer arrives able to add photos or only to look.
            accessibilityLabel={s.members.mayAdd}
            value={mayAdd}
            onValueChange={setMayAdd}
            disabled={busy}
            trackColor={{ false: color.line, true: color.ember }}
            thumbColor={color.paper}
            ios_backgroundColor={color.line}
          />
        </View>
        <Field
          label={s.username.label}
          value={username}
          onChangeText={setUsername}
          placeholder={s.username.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />
        <Button
          label={s.action.invite}
          onPress={sendInvite}
          disabled={busy || username.trim() === ''}
        />

        <Text role="meta">{s.members.inviteLink}</Text>
        {shareable === null ? (
          // Asked for rather than loaded with the screen: the api mints the link on this
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
        {/* The same notice as the one on the screen, because half of what it says is said in
            answer to something pressed in here — and the screen's copy is under the scrim. */}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.s5, paddingBottom: space.s8, gap: space.s3 },
  section: { marginTop: space.s4 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  own: { alignSelf: 'flex-end' },
  quiet: { alignSelf: 'flex-start' },
  gap: { height: space.s6 },
});
