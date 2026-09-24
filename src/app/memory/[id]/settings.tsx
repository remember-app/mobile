import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Pencil, UserPlus, X } from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ApiError,
  type ContributionStatus,
  deleteMemory,
  errorMessage,
  hasShared,
  listMembers,
  listMemories,
  type Member,
  type Memory,
  mayContribute,
  memberHandle,
  memberName,
  removeMember,
  setContributionStatus,
} from '@/api';
import {
  ActionBar,
  AppBar,
  BadgeContribution,
  Banner,
  Board,
  Button,
  ConfirmSheet,
  IconButton,
  PRESS,
  RowMember,
  Text,
  useFocusRing,
  useHoverFocus,
  useReducedMotion,
  Waiting,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatEventDates } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import { CoverSlot } from '@/screens/memory/cover';
import { InviteSheet } from '@/screens/memory/invite-sheet';
import { radius, space, themed } from '@/theme';

/**
 * `MemorySettings` (spec 8) — what the event is and who is in it. The people used to be the third
 * face of the memory itself; the memory is one screen of frames now, and its capsule leads here.
 *
 * What the caller may do is read off their own row in the roster — the api is the authority on all
 * of it, so nothing here is gated on anything the client made up. Whoever is not the organizer is
 * shown neither the pencil nor «Править состав» at all (spec 10.8.3): not greyed out, not drawn —
 * a disabled button promises it will one day press.
 *
 * Taking somebody out lives behind «Править состав» and not behind a cross that is always ready
 * (spec 10.8.4): an irreversible act is entered on purpose, and what it costs is named in figures on
 * the sheet that asks. Leaving a memory is not offered here at all (TASK-113) — the api still takes
 * it, and the organizer's cross uses that same call, but nobody is shown a way out of their own.
 */
export default function MemorySettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  // null means «not read yet» — the same distinction the home screen draws, so a refetch after an
  // invite keeps the roster on screen instead of flashing the spinner over it.
  const [memory, setMemory] = useState<Memory | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  // Whether the roster is being edited. The crosses live in here and nowhere else, so an ordinary
  // look at who is here cannot take anybody out by a misplaced finger.
  const [editing, setEditing] = useState(false);
  // Who the confirm sheet is asking about; null is «no sheet». The sheet is the whole state: holding
  // a boolean beside the member would let the two disagree.
  const [dropping, setDropping] = useState<Member | null>(null);
  const [wiping, setWiping] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    // The listing the home screen already reads answers everything the card needs — the name, the
    // days, the count, the cover — and it works however the screen was reached, a cold deep link
    // included. There is no route for one memory on its own.
    listMemories(token).then(
      (list) => setMemory(list.find((one) => one.id === id) ?? null),
      (e: unknown) => setError(errorMessage(e)),
    );
    // And the roster beside it. How much each person brought rides along on the row now (TASK-190);
    // this screen used to read the whole gallery to count it itself.
    listMembers(token, id).then(setMembers, (e: unknown) => setError(errorMessage(e)));
  }, [token, id]);

  // On focus rather than on mount, the way the home screen does it: everybody's standing changes
  // while whoever is reading it is off uploading, and the name and the cover change one screen away.
  useFocusEffect(load);

  // The button goes when there is nobody left to take out, and the mode goes with it: kept on, it
  // would be sitting there switched on the next time somebody joins, with a cross already beside
  // their name that nobody asked for.
  useEffect(() => {
    if (members !== null && members.length <= 1) setEditing(false);
  }, [members]);

  const me = members?.find((member) => member.id === user?.id) ?? null;
  const role = me?.role ?? null;
  const organizer = role === 'organizer';
  // doc-01: adding people is «Добавление» and up, and so is bringing photos. A viewer may look and
  // leave, nothing else. The api is the authority; this only decides what to draw.
  const mayInvite = mayContribute(role);
  // Two blocks and not one (spec 8): a viewer was never asked to bring anything, has no standing and
  // no count, and standing among the people waited on would put them in a column they are not in.
  const bringers = (members ?? []).filter((member) => mayContribute(member.role));
  const viewers = (members ?? []).filter((member) => member.role === 'viewer');
  // «3 из 5 всё скинули» — the organizer's whole progress, counted over the people who can actually
  // bring something. Who counts as having brought is `hasShared` and not «всё загрузил» alone
  // (doc-06): «ждать нечего» ends the wait just as flatly, and the api counts its own tally on the
  // main screen's card by that very rule.
  const brought = bringers.filter((member) => hasShared(member.contribution_status)).length;

  /**
   * Every api call this screen makes is the same shape: lock the controls, run one call, say one
   * line about it. `said` maps the statuses this particular call can come back with; anything else
   * falls through to the api's own wording.
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

  /** The standing is one press away from the next one, and the roster says which it landed on. */
  const turnStanding = (from: ContributionStatus) =>
    act(async (session) => {
      await setContributionStatus(session, id, NEXT[from]);
      load();
      return null;
    });

  const drop = (target: Member) =>
    act(
      async (session) => {
        try {
          await removeMember(session, id, target.id);
        } catch (e) {
          // 404 is «they are not in it any more»: somebody got there first. The line saying so is
          // about a roster this screen is still drawing wrong, so it is read again — left alone, the
          // row and its cross stood there under a line that contradicted them.
          if (e instanceof ApiError && e.status === 404) load();
          throw e;
        }
        load();
        return null;
      },
      { 404: s.members.gone },
    );

  /**
   * The memory itself, taken down whole (doc-01, 2026-09-24). There is nothing to stay for: the row
   * this whole screen stands on is gone, so the screen leaves for the main one, which reads its list
   * again on focus and will not find this memory in it. A 404 is somebody who got there first —
   * the same outcome, said the same way.
   */
  const wipe = () =>
    act(async (session) => {
      try {
        await deleteMemory(session, id);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
      router.replace('/');
      return null;
    });

  /**
   * How many frames that person brought here. `?? 0` and not a bare read: the app ships over the
   * air and the api deploys on its own, so a build that knows this field (TASK-190) can meet one
   * that does not — and «undefined кадров» would then stand under every name on the roster.
   */
  const framesOf = (member: Member) => s.memory.frames(member.media_count ?? 0);

  /** The one mark at the right edge of a row — the kit allows exactly one, so this picks it. */
  const markFor = (member: Member): ReactNode => {
    const self = member.id === user?.id;
    // Spec 10.8.4 — while the roster is being edited the mark is the cross. Never on one's own row:
    // the organizer does not take themselves out, so their own standing stays where it was.
    if (editing && organizer && !self)
      return (
        <IconButton
          size={36}
          icon={X}
          tone="danger"
          label={s.members.remove(memberName(member))}
          onPress={() => setDropping(member)}
          disabled={busy}
        />
      );
    // A viewer has no standing at all (TASK-190 answers `null`), and nothing stands in its place.
    const standing = member.contribution_status;
    if (standing === null) return null;
    const state = hasShared(standing) ? 'done' : 'planned';
    const word = s.standing[standing];
    // Spec 7.4 — your own is the same circle inside a 44 button: it is yours to change at any
    // moment, in either direction, and doc-06 keeps every door it opens open.
    return self ? (
      <StandingButton
        label={s.settings.yourStanding(word)}
        disabled={busy}
        onPress={() => void turnStanding(standing)}
      >
        <BadgeContribution state={state} label={word} />
      </StandingButton>
    ) : (
      <BadgeContribution state={state} label={word} />
    );
  };

  const row = (member: Member, index: number) => (
    <RowMember
      key={member.id}
      name={member.id === user?.id ? s.members.you(memberName(member)) : memberName(member)}
      // Spec 8 writes the second line as the count and nothing else: «Роли в строке не выделяем»,
      // and the organizer is already told by the `spark` collar on their circle. A viewer's row
      // carries no meta at all — there is nothing behind them to count.
      meta={member.role === 'viewer' ? undefined : framesOf(member)}
      ring={member.role === 'organizer'}
      status={markFor(member)}
      divider={index > 0}
    />
  );

  return (
    <Board>
      <AppBar
        // The screen's own name and not the memory's: the name of the memory is on the card right
        // under it, in the one place it is edited from.
        title={s.settings.title}
        left={
          <IconButton
            icon={ChevronLeft}
            label={s.action.back}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace({ pathname: '/memory/[id]', params: { id } })
            }
          />
        }
      />

      <ScrollView contentContainerStyle={styles.body}>
        {error !== null ? (
          <Banner tone="error" text={error}>
            <Button size="xs" variant="quiet" label={s.action.retry} onPress={load} />
          </Banner>
        ) : memory === null || members === null ? (
          <View style={styles.middle}>
            <Waiting text={s.state.loading} />
          </View>
        ) : (
          <>
            {/* What this memory is, and — for the organizer — the one way into changing it. Three
                things behind one pencil, because they are edited in one go (spec 10.8.3). */}
            <View style={styles.event}>
              <CoverSlot uri={memory.cover_thumbnail_url} thumbs={memory.recent_thumbnail_urls} />
              <View style={styles.grow}>
                <Text role="subtitleDisplay" numberOfLines={1}>
                  {memory.title}
                </Text>
                <Text role="meta" numberOfLines={1}>
                  {[
                    formatEventDates(memory.event_start, memory.event_end),
                    s.memory.frames(memory.media_count),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              {organizer ? (
                <IconButton
                  icon={Pencil}
                  tone="raise"
                  label={s.settings.edit}
                  disabled={busy}
                  onPress={() => router.push({ pathname: '/memory/[id]/edit', params: { id } })}
                />
              ) : null}
            </View>

            <View style={styles.block}>
              <View style={styles.head}>
                <View style={styles.headWords}>
                  <Text role="section" accessibilityRole="header">
                    {s.members.title}
                  </Text>
                  <Text role="meta">{s.members.brought(brought, bringers.length)}</Text>
                </View>
                {/* Spec 10.8.4: the way in becomes the way out — the pencil goes, the word becomes
                    «Готово», and the button itself is held in. Nobody to take out (a memory with
                    only you in it) and there is no button at all. */}
                {organizer && members.length > 1 ? (
                  <Button
                    variant={editing ? 'paper' : 'small'}
                    size="xs"
                    icon={editing ? undefined : Pencil}
                    label={editing ? s.action.done : s.members.edit}
                    onPress={() => setEditing((was) => !was)}
                    disabled={busy}
                  />
                ) : null}
              </View>
              {/* A `.map` and not a FlatList: this is one event's guest list inside a ScrollView,
                  and nesting a virtualised list in one is the thing React Native asks you not to do.
                  The card around it is what the rows' own hairlines are drawn inside. */}
              <View style={styles.card}>{bringers.map(row)}</View>
            </View>

            {/* «Зрители» — a block of its own, under everybody else, and not there at all when
                nobody is only watching (spec 8). */}
            {viewers.length > 0 ? (
              <View style={styles.block}>
                <View style={styles.headWords}>
                  <Text role="section" accessibilityRole="header">
                    {s.settings.viewers}
                  </Text>
                  <Text role="meta">{viewers.length}</Text>
                </View>
                <View style={styles.card}>{viewers.map(row)}</View>
              </View>
            ) : null}

            {/* The end of the memory: at the bottom, alone, behind a hairline — exactly where
                `Account` keeps «Выйти из аккаунта» (spec 8), so that nothing dangerous is hit on the
                way past. Nobody but the organizer is drawn it at all (spec 10.8.3: not greyed out —
                not drawn), and the api refuses everybody else on its own. */}
            {organizer ? (
              <View style={styles.out}>
                <Button
                  variant="danger"
                  size="xl"
                  label={s.settings.delete}
                  disabled={busy}
                  onPress={() => setWiping(true)}
                />
              </View>
            ) : null}
          </>
        )}

        {notice ? <Banner text={notice} /> : null}
      </ScrollView>

      {/* The one glowing action of the screen: the whole reason it exists is that there be more
          people in the memory. Behind the same level the api gates inviting on — a viewer is shown
          neither this nor the crosses, and for them the screen simply ends with the roster. */}
      {mayInvite ? (
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

      <InviteSheet
        visible={inviting}
        onCancel={() => setInviting(false)}
        memoryId={id}
        members={members}
        onInvited={load}
      />

      {/* The sheet that asks about the memory: the thing on it is its cover — or, with none chosen,
          the first of the frames its card is drawn from — the meta is its name and its days, and the
          price is in figures, how many frames and movies go. Counted off the frames, as the sheet
          beside it counts a departure: the price always opens with them, so a memory with none says
          «0 кадров исчезнут» — a price nobody is paying — however many movies were cut from them. */}
      {wiping && memory !== null ? (
        <ConfirmSheet
          visible
          thumb={memory.cover_thumbnail_url ?? memory.recent_thumbnail_urls[0]}
          meta={[memory.title, formatEventDates(memory.event_start, memory.event_end)]
            .filter(Boolean)
            .join(' · ')}
          price={
            memory.media_count
              ? s.settings.deletePrice(memory.media_count, memory.montage_count)
              : undefined
          }
          title={s.settings.deleteAsk}
          text={s.settings.deleteText}
          confirmLabel={s.settings.deleteDo}
          cancelLabel={s.settings.keep}
          onConfirm={() => {
            setWiping(false);
            void wipe();
          }}
          onCancel={() => setWiping(false)}
        />
      ) : null}

      {/* `SheetConfirmMember` — irreversible, and doc-01 takes the material with the person. So the
          sheet carries their face, what they brought, and the price in figures before the press; the
          button repeats the verb of the question. A viewer has nothing behind them, so there is no
          price and the paragraph says what is actually lost (spec 10.8.4). */}
      {dropping !== null ? (
        <ConfirmSheet
          visible
          who={memberName(dropping)}
          meta={[memberHandle(dropping), dropping.role === 'viewer' ? null : framesOf(dropping)]
            .filter(Boolean)
            .join(' · ')}
          price={dropping.media_count ? s.members.priceFrames(dropping.media_count) : undefined}
          title={s.members.removeAsk(memberName(dropping))}
          text={dropping.role === 'viewer' ? s.members.removeViewerText : s.members.removeText}
          confirmLabel={s.members.removeDo}
          cancelLabel={s.members.keepThem}
          onConfirm={() => {
            const target = dropping;
            setDropping(null);
            void drop(target);
          }}
          onCancel={() => setDropping(null)}
        />
      ) : null}
    </Board>
  );
}

/**
 * Where one press on your own standing lands (doc-06). Three answers and not four — `not_started` is
 * what an invite leaves behind and nobody asks for it back — and the ring closes, so no press is ever
 * the last one: «сказал „это всё“, а потом вспомнил про второй телефон».
 */
const NEXT: Record<ContributionStatus, 'more_coming' | 'done' | 'nothing'> = {
  not_started: 'done',
  more_coming: 'done',
  done: 'nothing',
  nothing: 'more_coming',
};

/**
 * The 44 your own standing lives inside (spec 7.4). Its own button and not the kit's round one: what
 * it holds is the contribution circle, not a glyph, and the kit's `IconButton` draws glyphs. The
 * press dip, the focus ring and the reach out to 44 all come from the kit either way.
 */
function StandingButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const { focused, props } = useHoverFocus();
  const reduced = useReducedMotion();
  const focusRing = useFocusRing();
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      {...props}
      style={({ pressed }) => [
        styles.standing,
        pressed && !reduced ? PRESS : null,
        focused ? focusRing : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // Spec 8: the body starts under the bar in the screen's own 16, and the blocks stand 22 apart.
    body: { flexGrow: 1, paddingHorizontal: space.s4, paddingBottom: space.s6, gap: 22 },
    // Waiting holds the place of the roster in the middle of the body rather than blinking at the top.
    middle: { flex: 1, justifyContent: 'center' },
    event: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      borderRadius: radius.card,
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
    },
    block: { gap: 10 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    // The heading and its count share a baseline, the way the layout sets every pair of them.
    headWords: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: space.s2,
      minWidth: 0,
    },
    // The rows stand inside one surface with the corners cut off it, so the hairline between two of
    // them never reaches the rounding.
    card: {
      borderRadius: radius.card,
      overflow: 'hidden',
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
    },
    grow: { flex: 1, minWidth: 0 },
    // The dangerous one stands at the very bottom of the body, alone behind a hairline — the way
    // out of an account stands on `Account`.
    out: { marginTop: 'auto', paddingTop: space.s5, borderTopWidth: 1, borderTopColor: color.line },
    // Spec 10.2: drawn as the 28 circle inside it, felt at 44 — and pulled 8 out, so the circle
    // lines up with the row's own 14 rather than with the button's edge.
    standing: {
      width: 44,
      height: 44,
      marginRight: -8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
  }),
);
