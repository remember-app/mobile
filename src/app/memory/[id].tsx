import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ChevronLeft, Download, Film, Share2, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiError,
  errorMessage,
  fetchInvite,
  inviteByUsername,
  listMemories,
  listMembers,
  listMontages,
  mayContribute,
  orderMontage,
  removeMember,
  retryMontage,
  rotateInvite,
  setContributionStatus,
  type ContributionStatus,
  type Invite,
  type Member,
  type MemberRole,
  type Memory,
  type Montage,
  type MusicTrackId,
} from '@/api';
import { useAuth } from '@/auth';
import { formatDay, formatEventDates, formatRuntime } from '@/dates';
import { maySaveToPhone, REFUSED, saveToPhone } from '@/downloads';
import {
  ActionBar,
  AppBar,
  Banner,
  Button,
  CardMontage,
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
  type MontageState,
} from '@/kit';
import { color, space } from '@/theme';

/** The three levels of doc-01 «Права доступа», said the way a person would say them. */
const ROLE: Record<MemberRole, string> = {
  organizer: 'Organizer',
  contributor: 'Can add photos',
  viewer: 'View only',
};

/** The four standings of doc-06, said the same way — this is «прогресс у организатора». */
const CONTRIBUTION: Record<ContributionStatus, string> = {
  not_started: 'Nothing uploaded yet',
  more_coming: 'Still adding photos',
  done: 'Uploaded everything',
  nothing: 'Nothing to add',
};

/** Whoever it is, under whichever of the two names they have. */
const label = (member: Member) => member.name ?? member.username ?? 'Someone';

/** The four standings a montage can be in, in the three the kit draws (section 10). */
const MONTAGE_STATE: Record<Montage['status'], MontageState> = {
  queued: 'pending',
  processing: 'pending',
  ready: 'ready',
  failed: 'failed',
};

/**
 * The word beside the dot. None of them says how long it will be or how far along it is: the api
 * carries neither, and the kit's «Минут пять» would be this screen making a number up.
 */
const MONTAGE_STATUS: Record<Montage['status'], string> = {
  queued: 'Waiting its turn',
  processing: 'Being made',
  ready: 'Ready',
  failed: 'Did not finish',
};

/** The worker's three tracks, under names to pick between. The ids are the api's own. */
const TRACK: Record<MusicTrackId, string> = { warm: 'Warm', bright: 'Bright', calm: 'Calm' };

/**
 * How long to ask for. The api takes anything from a quarter of a minute to five and fills in a
 * minute itself when nothing is asked — these are three round answers, not the whole range.
 */
const LENGTHS = [
  { seconds: 30, label: 'Half a minute' },
  { seconds: 60, label: 'A minute' },
  { seconds: 120, label: 'Two minutes' },
];

/**
 * What a montage is called on screen: how long it runs once it does, and the day it was asked for
 * until then — a length is the one thing about it that is worth a title, and there is none to say
 * until the worker has made it.
 */
const montageTitle = (montage: Montage) => {
  const runtime = formatRuntime(montage.duration_seconds);
  return runtime ? `Montage of ${runtime}` : `Montage from ${formatDay(montage.created_at)}`;
};

/**
 * One memory: who is in it, how to get more people in, and how to get out. What the caller
 * may do is read off their own row in the roster — the api is the authority on that, so
 * nothing here is gated on anything the client made up.
 */
export default function MemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
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
  // The videos and their own way of going wrong — the list is the one call here that answers 503
  // when the api has no bucket, and that must not be the roster's problem too.
  const [montages, setMontages] = useState<Montage[] | null>(null);
  const [montageError, setMontageError] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  // What the order will ask for. The api's own default length, and a track chosen rather than left
  // to the worker — it is one tap either way, and a person who opened the sheet came to choose.
  const [seconds, setSeconds] = useState(60);
  const [track, setTrack] = useState<MusicTrackId>('warm');
  /** The montage being watched, held by id so a reload hands it a fresh signed url. */
  const [playing, setPlaying] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    setMontageError(null);
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
    // Beside that pair rather than in it: the montage list is the one call on this screen that
    // answers 503 over a bucket nobody configured, and a memory that lost its roster and its way
    // out over «no videos to be had» would be a screen with nothing left on it.
    listMontages(token, id).then(setMontages, (e: unknown) => setMontageError(errorMessage(e)));
  }, [token, id]);

  useEffect(load, [load]);

  const me = members?.find((member) => member.id === user?.id) ?? null;
  const role = me?.role ?? null;
  // doc-01: adding people is «Добавление» and up, and so is bringing photos — whoever may bring
  // people to a memory may bring material to it. A viewer may look and leave, nothing else. Until
  // the upload button existed, that screen was reachable only by tapping the invite push, which
  // left everybody who joined by link with no way to the one thing they were invited for.
  const mayContributeHere = mayContribute(role);
  const newcomerRole = mayAdd ? 'contributor' : 'viewer';
  // Derived together so the branch below narrows both at once: there is a link exactly when
  // there is an invite. `remember://` is the scheme in app.json; TASK-16 is what receives it.
  const shareable = invite && {
    link: `remember://invite?token=${encodeURIComponent(invite.token)}`,
    grants: ROLE[invite.role],
  };
  // Checked against `dropping` first, so a closed sheet is never «about me» by two undefineds.
  const leaving = dropping !== null && dropping.id === user?.id;
  const watching = montages?.find((montage) => montage.id === playing) ?? null;

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

  /**
   * «Смонтируй ролик», with the two wishes doc-03 allows. The api answers with the row it wrote,
   * so it goes straight onto the top of the list — the list is newest first, and a reload would be
   * the same thing one round trip later.
   */
  const order = () =>
    act(
      async (session) => {
        const ordered = await orderMontage(session, id, {
          target_seconds: seconds,
          music_track_id: track,
        });
        setMontages((have) => [ordered, ...(have ?? [])]);
        setOrdering(false);
        return 'Ordered. Everyone here is told when it is ready.';
      },
      {
        // The api's own line names its numbers; this one names what to do about them.
        409: 'Too little material for a montage yet — add a few more photos or videos first.',
        403: 'Only the organizer can order a montage.',
      },
    );

  /** The organizer's button under one that fell over: the same row queued again, never a second. */
  const retry = (montage: Montage) =>
    act(
      async (session) => {
        const requeued = await retryMontage(session, id, montage.id);
        setMontages((have) => have?.map((one) => (one.id === montage.id ? requeued : one)) ?? null);
        return null;
      },
      {
        409: 'That one is already on its way again.',
        403: 'Only the organizer can start it again.',
      },
    );

  /**
   * The finished video kept and then handed on — doc-03 asks for both, and this is one press
   * because the local copy the share sheet needs exists only between the two. The sheet is opened
   * on that copy and not on `video_url`: the link is signed and dies in a quarter of an hour, so
   * whoever it was sent to would get a refusal instead of a video.
   *
   * ponytail: React Native's own `Share` attaches a file on iOS only — on Android the sheet goes
   * out with the line and without the video, which is by then in the phone's gallery and shareable
   * from there. `expo-sharing` is the upgrade when that is not good enough.
   */
  async function keep(montage: Montage) {
    if (montage.video_url === null) return;
    setBusy(true);
    // The whole of the progress there is: a save is atomic, the same way the gallery's is.
    setNotice('Saving to your gallery…');
    try {
      if (!(await maySaveToPhone())) {
        setNotice(REFUSED);
        return;
      }
      await saveToPhone({ id: montage.id, kind: 'video', url: montage.video_url }, async (uri) => {
        // Dismissing the sheet is not a failure, and neither is a phone with nowhere to send it.
        await Share.share({
          url: uri,
          message: memory ? `Montage from «${memory.title}»` : montageTitle(montage),
        }).catch(() => {});
      });
      setNotice('Saved to your gallery.');
    } catch {
      // Nothing here is the api's doing: the link came with the list, and past that it is the
      // download or the phone's own gallery.
      setNotice('Could not save this montage to your phone.');
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top }]}>
      <AppBar
        title={memory?.title ?? 'Memory'}
        left={
          <IconButton
            icon={ChevronLeft}
            label="Back"
            // A tapped invite push opens this screen with nothing behind it to go back to.
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        }
      />
      {memory ? (
        <Text role="meta">{formatEventDates(memory.event_start, memory.event_end)}</Text>
      ) : null}

      {/* Section 10, in the place the placeholder held: the kit calls the montage the reward, so it
          gets the most visible spot on the screen. Its own block, above the roster and nowhere near
          the gallery button — «Ролики не смешиваются с галереей» (doc-03). Behind no role at all:
          the video is what everybody who brought material gets back, so a viewer reads the list
          too. Only the organizer orders one, and only the organizer starts a fallen one again. */}
      {montageError !== null ? (
        <Banner tone="error" text={montageError}>
          <Button sm variant="quiet" label="Try again" onPress={load} />
        </Banner>
      ) : montages === null ? null : (
        <>
          {montages.map((montage) => (
            <View key={montage.id} style={styles.montage}>
              <CardMontage
                state={MONTAGE_STATE[montage.status]}
                title={montageTitle(montage)}
                status={MONTAGE_STATUS[montage.status]}
                // Said in place of a bar or a number: nothing on this side knows how far along the
                // worker is, and the push is what actually brings people back to look.
                caption="You will be told when it is ready"
                playLabel={`Watch ${montageTitle(montage)}`}
                onPlay={montage.video_url === null ? undefined : () => setPlaying(montage.id)}
                actions={
                  montage.status === 'ready' ? (
                    <Button
                      sm
                      icon={Download}
                      label="Save and share"
                      disabled={busy || montage.video_url === null}
                      onPress={() => void keep(montage)}
                    />
                  ) : montage.status === 'failed' && role === 'organizer' ? (
                    <Button
                      sm
                      label="Try again"
                      onPress={() => void retry(montage)}
                      disabled={busy}
                    />
                  ) : null
                }
              />
              {/* The kit's own rule is that a failure is not explained by a code — so the word
                  beside the dot stays the screen's, and the worker's own line goes under the card,
                  where there is room for it and where it is not the first thing read. */}
              {montage.status === 'failed' && montage.error_text !== null ? (
                <Text role="meta">{montage.error_text}</Text>
              ) : null}
            </View>
          ))}

          {role === 'organizer' ? (
            // The screen's one glowing button for the organizer: doc-03 makes ordering theirs
            // alone, and it is the thing the whole memory is being filled up for.
            <Button
              variant="primary"
              label="Make a montage"
              onPress={() => setOrdering(true)}
              disabled={busy}
            />
          ) : montages.length === 0 ? (
            <Empty icon={Film} text="No montage yet — the organizer can ask for one." />
          ) : null}
        </>
      )}

      {error !== null ? (
        <Banner tone="error" text={error}>
          <Button sm variant="quiet" label="Try again" onPress={load} />
        </Banner>
      ) : members === null ? (
        <Empty busy text="Loading…" />
      ) : (
        <>
          {/* Behind no role at all: looking at the material is what every member may do, a viewer
              included (doc-01). The count is the memory's own, so it says «empty» before opening.
              It is also the one glowing button for a viewer, who has nothing else to press here. */}
          <Button
            variant={mayContributeHere ? 'secondary' : 'primary'}
            label={`Photos and videos${memory ? ` (${memory.media_count})` : ''}`}
            onPress={() => router.push({ pathname: '/memory/[id]/gallery', params: { id } })}
          />

          {mayContributeHere ? (
            <>
              {/* The kit gives the glow to exactly one thing per screen. For the organizer that is
                  now «Make a montage» above — theirs is the memory being filled up for a reason,
                  and this button keeps its place without the ember. For a contributor, bringing
                  material is still the main thing they are here to do. */}
              <Button
                variant={role === 'organizer' ? 'secondary' : 'primary'}
                label="Add photos and videos"
                onPress={() => router.push({ pathname: '/memory/[id]/upload', params: { id } })}
              />
              {/* The whole of getting someone in, behind one button of the same size as the two
                  above it — it belongs with the actions, and it stands right over the roster it
                  adds to. */}
              <Button label="Invite" onPress={() => setInviting(true)} />
            </>
          ) : null}

          <Text role="meta" style={styles.section}>
            Who is here
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
                    name={`${label(member)}${self ? ' (you)' : ''}`}
                    // Section 7 writes «@marina · 42 кадра» on one line, so the standing goes
                    // beside the username rather than under it. The wording is doc-06's own.
                    meta={[
                      member.username && `@${member.username}`,
                      CONTRIBUTION[member.contribution_status],
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    divider={index > 0}
                  >
                    <Chip label={ROLE[member.role]} organizer={member.role === 'organizer'} />
                    {role === 'organizer' && !self ? (
                      <IconButton
                        icon={X}
                        size={ICO_S}
                        label={`Remove ${label(member)}`}
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
                      label="Nothing to add"
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
                label="Leave this memory"
                onPress={() => me && setDropping(me)}
                disabled={busy}
              />
            </>
          ) : null}
        </>
      )}

      {notice ? <Banner text={notice} /> : null}

      {/* The two wishes doc-03 allows and nothing else, asked on a sheet the way an invite is:
          ordering is a thing done once, and the screen is for what comes of it. What is picked is
          in the heading above each row as well as in the buttons — a screen reader gets no «this
          one is chosen» out of a button that only looks different. */}
      <Sheet visible={ordering} onCancel={() => setOrdering(false)}>
        <Text accessibilityRole="header" role="title">
          Make a montage
        </Text>
        <Text role="meta">
          Everything in this memory goes in, and the agent picks the moments itself. What comes out
          is not edited afterwards.
        </Text>

        <Text role="label">
          How long · {LENGTHS.find((one) => one.seconds === seconds)?.label}
        </Text>
        <View style={styles.choices}>
          {LENGTHS.map((length) => (
            <Button
              key={length.seconds}
              sm
              // The picked one is the one with a frame around it. Not `primary`: the glow belongs
              // to one thing on a surface, and here that is «Make it» at the bottom.
              variant={length.seconds === seconds ? 'secondary' : 'quiet'}
              label={length.label}
              onPress={() => setSeconds(length.seconds)}
              disabled={busy}
            />
          ))}
        </View>

        <Text role="label">Music · {TRACK[track]}</Text>
        <View style={styles.choices}>
          {(Object.keys(TRACK) as MusicTrackId[]).map((id) => (
            <Button
              key={id}
              sm
              variant={id === track ? 'secondary' : 'quiet'}
              label={TRACK[id]}
              onPress={() => setTrack(id)}
              disabled={busy}
            />
          ))}
        </View>

        <Button variant="primary" label="Make it" onPress={order} busy={busy} disabled={busy} />
        {/* Where «too little material» is read: the sheet stays up when the order is refused, and
            the screen's own copy of this line is under the scrim. */}
        {notice ? <Banner text={notice} /> : null}
      </Sheet>

      {/* The finished video played where it lies, the way the gallery plays a preview: `expo-video`
          streams it from the signed link rather than downloading it first. A modal and not a screen
          — there is nothing to do in here but watch it and close it. */}
      <Modal
        visible={watching !== null}
        animationType="fade"
        onRequestClose={() => setPlaying(null)}
        // Landscape too: a montage is 16:9 and worth turning the phone for, and the rest of the
        // app is portrait-only.
        supportedOrientations={['portrait', 'landscape']}
      >
        {watching === null || watching.video_url === null ? null : (
          <View style={styles.viewer}>
            <Playing url={watching.video_url} />
            <ActionBar style={styles.bar}>
              <Button variant="quiet" label="Close" onPress={() => setPlaying(null)} />
            </ActionBar>
          </View>
        )}
      </Modal>

      {/* Both roads in, on one sheet: the level a newcomer arrives at is the same question for
          both, and it is asked once above them. `visible` and nothing else — the Modal drops its
          children while hidden, so each open starts the rise over. */}
      <Sheet visible={inviting} onCancel={() => setInviting(false)}>
        <Text accessibilityRole="header" role="title">
          Invite someone
        </Text>
        <View style={styles.toggle}>
          <Text role="label">They can add photos too</Text>
          {/* The kit has no switch of its own, so the platform's takes the kit's colours. */}
          <Switch
            // Its own name, because the label beside it is only a sibling — and this one
            // decides whether a newcomer arrives able to add photos or only to look.
            accessibilityLabel="They can add photos too"
            value={mayAdd}
            onValueChange={setMayAdd}
            disabled={busy}
            trackColor={{ false: color.line, true: color.ember }}
            thumbColor={color.paper}
            ios_backgroundColor={color.line}
          />
        </View>
        <Field
          label="Username"
          value={username}
          onChangeText={setUsername}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />
        <Button label="Invite" onPress={sendInvite} disabled={busy || username.trim() === ''} />

        <Text role="meta">Invite link</Text>
        {shareable === null ? (
          // Asked for rather than loaded with the screen: the api mints the link on this
          // very call, and a memory nobody shares should not carry one.
          <Button label="Get the link" onPress={showLink} disabled={busy} />
        ) : (
          <>
            <InviteLink url={shareable.link}>
              {/* The platform's own share sheet, which is also the copy button — no
                  clipboard dependency for something every OS already does better. */}
              <Button
                sm
                icon={Share2}
                label="Share"
                onPress={() => void Share.share({ message: shareable.link }).catch(() => {})}
                disabled={busy}
              />
            </InviteLink>
            <Text role="meta">Whoever follows it joins as «{shareable.grants}».</Text>
            {/* Section 11: replacing a link is a quiet thing beside it, not a red button. */}
            <Button
              sm
              variant="quiet"
              label="Replace the link"
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
          title={leaving ? 'Leave this memory?' : `Remove ${label(dropping)}?`}
          text={
            leaving
              ? 'Everything you uploaded here goes with you. There is no getting it back.'
              : 'Everything they uploaded here goes with them. There is no getting it back.'
          }
          confirmLabel={leaving ? 'Leave' : 'Remove'}
          cancelLabel={leaving ? 'Stay' : 'Keep them'}
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

/**
 * The montage, played from its signed link. Its own component because the player is a hook, and
 * this one is mounted only while the video is on screen — leaving it releases the player. The
 * gallery has the same three lines for its previews; they are glue, and sharing them would mean
 * handing one component two screens' styles to save three lines.
 */
function Playing({ url }: { url: string }) {
  const player = useVideoPlayer(url, (video) => video.play());
  return <VideoView player={player} style={styles.big} />;
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.s5, paddingBottom: space.s8, gap: space.s3 },
  section: { marginTop: space.s4 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  own: { alignSelf: 'flex-end' },
  quiet: { alignSelf: 'flex-start' },
  gap: { height: space.s6 },
  // A card and, under a fallen one, the line the worker left — closer to each other than the
  // screen's own gap, because they are one thing.
  montage: { gap: space.s2 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  viewer: { flex: 1, backgroundColor: color.ink, justifyContent: 'center' },
  bar: { justifyContent: 'center', paddingHorizontal: space.s4 },
  big: { flex: 1, width: '100%' },
});
