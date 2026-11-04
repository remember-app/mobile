import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2, UserPlus, X } from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  ApiError,
  type ContributionStatus,
  deleteMemory,
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
  BackButton,
  BadgeContribution,
  Banner,
  Board,
  Button,
  ConfirmSheet,
  CoverSlot,
  DRAWN,
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
import { type Failure, failure, type Refusals, said, saying } from '@/lib/failure';
import { useStrings } from '@/lib/language';
import { InviteSheet } from '@/screens/memory/invite-sheet';
import { board, height, radius, space, themed } from '@/theme';
export default function MemorySettingsScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const styles = useStyles();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Failure | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dropping, setDropping] = useState<Member | null>(null);
  const [wiping, setWiping] = useState(false);
  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    listMemories(token).then(
      (list) => setMemory(list.find((one) => one.id === id) ?? null),
      (e: unknown) => setError(failure(e)),
    );
    listMembers(token, id).then(setMembers, (e: unknown) => setError(failure(e)));
  }, [token, id]);
  useFocusEffect(load);
  useEffect(() => {
    if (members !== null && members.length <= 1) setEditing(false);
  }, [members]);
  const me = members?.find((member) => member.id === user?.id) ?? null;
  const role = me?.role ?? null;
  const organizer = role === 'organizer';
  const mayInvite = mayContribute(role);
  const bringers = (members ?? []).filter((member) => mayContribute(member.role));
  const viewers = (members ?? []).filter((member) => member.role === 'viewer');
  const brought = bringers.filter((member) => hasShared(member.contribution_status)).length;
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
          if (e instanceof ApiError && e.status === 404) load();
          throw e;
        }
        load();
        return null;
      },
      { 404: { text: saying(s.members.gone) } },
    );
  const wipe = async () => {
    await act(async (session) => {
      try {
        await deleteMemory(session, id);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
      router.dismissAll();
      router.replace('/');
      return null;
    });
    setWiping(false);
  };
  const lost = (of: Pick<Member, 'media_count' | 'removal_media_count'>) =>
    of.removal_media_count ?? of.media_count ?? 0;
  const othersLost = (members ?? [])
    .filter((member) => member.role !== 'organizer')
    .reduce((sum, member) => sum + lost(member), 0);
  const framesOf = (member: Member) => s.memory.frames(member.media_count ?? 0);
  const markFor = (member: Member): ReactNode => {
    const self = member.id === user?.id;
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
    const standing = member.contribution_status;
    if (standing === null) return null;
    const state = hasShared(standing) ? 'done' : 'planned';
    const word = s.standing[standing];
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
      meta={member.role === 'viewer' ? undefined : framesOf(member)}
      status={markFor(member)}
      divider={index > 0}
    />
  );
  return (
    <Board
      bar={
        <AppBar
          title={s.settings.title}
          quiet={
            organizer && memory !== null
              ? {
                  icon: Trash2,
                  label: s.settings.delete,
                  onPress: () => setWiping(true),
                  disabled: busy,
                }
              : undefined
          }
          left={
            <BackButton
              label={s.action.back}
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace({ pathname: '/memory/[id]', params: { id } })
              }
            />
          }
        />
      }
      footer={
        mayInvite ? (
          <ActionBar>
            <Button
              variant="primary"
              wide
              icon={UserPlus}
              glyph={{ size: 19, stroke: 1.9 }}
              label={s.action.invite}
              onPress={() => setInviting(true)}
              disabled={busy}
            />
          </ActionBar>
        ) : undefined
      }
      body={styles.body}
    >
      {error !== null ? (
        <Banner tone="error" failure={error}>
          <Button size="xs" variant="quiet" label={s.action.retry} onPress={load} />
        </Banner>
      ) : memory === null || members === null ? (
        <View style={styles.middle}>
          <Waiting text={s.state.loading} />
        </View>
      ) : (
        <>
          <View style={styles.event}>
            <CoverSlot uri={memory.cover_thumbnail_url} thumbs={memory.recent_thumbnail_urls} />
            <View style={styles.grow}>
              <Text role="titleSm">{memory.title}</Text>
              <Text role="meta">
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
                icon={DRAWN.pen}
                glyph={{ size: 17, stroke: 1.8 }}
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

              {organizer && members.length > 1 ? (
                <Button
                  variant={editing ? 'paper' : 'outline'}
                  size="mini"
                  wide={false}
                  icon={editing ? undefined : DRAWN.pen}
                  label={editing ? s.action.done : s.members.edit}
                  onPress={() => setEditing((was) => !was)}
                  disabled={busy}
                />
              ) : null}
            </View>

            <View style={styles.card}>{bringers.map(row)}</View>
          </View>

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
        </>
      )}

      {notice ? <Banner failure={notice} /> : null}

      <InviteSheet
        visible={inviting}
        onCancel={() => setInviting(false)}
        memoryId={id}
        members={members}
        onInvited={load}
      />

      {wiping && memory !== null && members !== null ? (
        <ConfirmSheet
          visible
          cover={{ uri: memory.cover_thumbnail_url, thumbs: memory.recent_thumbnail_urls }}
          meta={`${memory.title} · ${s.memory.frames(lost(memory))}`}
          price={othersLost > 0 ? s.settings.deleteOthers(othersLost) : undefined}
          priceOn="ink"
          title={s.settings.deleteAsk}
          text={s.settings.deleteText(members.length)}
          confirmLabel={s.settings.deleteDo}
          cancelLabel={s.settings.keep}
          busy={busy}
          onConfirm={() => void wipe()}
          onCancel={() => setWiping(false)}
        />
      ) : null}

      {dropping !== null ? (
        <ConfirmSheet
          visible
          who={memberName(dropping)}
          meta={[
            memberHandle(dropping),
            dropping.role === 'viewer' ? null : s.memory.frames(lost(dropping)),
          ]
            .filter(Boolean)
            .join(' · ')}
          price={lost(dropping) ? s.members.priceFrames(lost(dropping)) : undefined}
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
const NEXT: Record<ContributionStatus, 'more_coming' | 'done' | 'nothing'> = {
  not_started: 'done',
  more_coming: 'done',
  done: 'nothing',
  nothing: 'more_coming',
};
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
    body: {
      flexGrow: 1,
      paddingTop: board.bodySettings - board.status - height.bar,
      paddingHorizontal: space.s4,
      paddingBottom: space.s6,
      gap: 22,
    },
    middle: { flexGrow: 1, justifyContent: 'center' },
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
    head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    headWords: {
      flexGrow: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      gap: space.s2,
      paddingLeft: 2,
    },
    card: {
      borderRadius: radius.card,
      overflow: 'hidden',
      backgroundColor: color.surface,
      borderWidth: 1,
      borderColor: color.line,
    },
    grow: { flex: 1, minWidth: 0, gap: 5 },
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
