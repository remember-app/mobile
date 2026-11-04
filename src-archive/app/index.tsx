import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, Plus, User, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { errorMessage, listMemories, type Memory } from '@/api';
import {
  ActionBar,
  AppBar,
  BadgeFilms,
  BadgeOrganizer,
  Banner,
  Board,
  Button,
  CardMemory,
  Empty,
  IconButton,
  useFooterOverhang,
  Waiting,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatEventDates } from '@/lib/dates';
import { answered } from '@/lib/failure';
import { useStrings } from '@/lib/language';
import { board, duration, height, space } from '@/theme';

type Link = 'ok' | 'back' | 'gone' | 'hushed';
export default function HomeScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const overhang = useFooterOverhang();
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [link, setLink] = useState<Link>('ok');
  const [failed, setFailed] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!token) return;
    listMemories(token).then(
      (list) => {
        setMemories(list);
        setFailed(null);
        setLink((was) => (was === 'gone' || was === 'hushed' ? 'back' : was));
      },
      (e: unknown) => {
        setFailed(errorMessage(e));
        if (!answered(e)) setLink('gone');
      },
    );
  }, [token]);
  useFocusEffect(load);
  useEffect(() => {
    if (link !== 'back') return;
    const leaves = setTimeout(() => setLink('ok'), duration.hold);
    return () => clearTimeout(leaves);
  }, [link]);
  const banner =
    link === 'gone' ? (
      <Banner
        text={s.state.offline}
        hide={{ label: s.action.hide, onPress: () => setLink('hushed') }}
      />
    ) : link === 'back' ? (
      <Banner tone="done" text={s.state.online} />
    ) : null;
  return (
    <Board
      bar={
        <AppBar
          variant="root"
          title={s.home.title}
          right={
            <IconButton
              icon={User}
              label={s.home.account}
              tone="surface"
              onPress={() => router.push('/profile')}
            />
          }
        />
      }
      footer={
        <ActionBar>
          <Button
            label={s.home.create}
            variant="primary"
            icon={Plus}
            wide
            disabled={memories === null && failed === null}
            onPress={() => router.push('/create')}
          />
        </ActionBar>
      }
      body={[styles.body, styles.lead, styles.mid, { paddingBottom: overhang }]}
      list={
        memories === null
          ? undefined
          : ({ head, foot }) => (
              <FlatList
                data={memories}
                keyExtractor={(memory) => memory.id}
                contentContainerStyle={[
                  styles.body,
                  banner ? styles.leadBanner : styles.lead,
                  styles.list,
                  memories.length === 0 ? [styles.mid, { paddingBottom: overhang }] : null,
                ]}
                ListHeaderComponent={
                  head || banner ? (
                    <>
                      {head ? <View style={styles.edge}>{head}</View> : null}
                      {banner}
                    </>
                  ) : null
                }
                ListFooterComponent={foot ? <View style={styles.edge}>{foot}</View> : null}
                ListEmptyComponent={
                  <Empty sign="spark" icon={Camera} title={s.home.emptyTitle} text={s.home.empty} />
                }
                renderItem={({ item, index }) => {
                  const thumbs = item.card_thumbnail_urls ?? item.recent_thumbnail_urls ?? [];
                  const cover = item.cover_thumbnail_url ?? null;
                  const large = index === 0 && (cover !== null || thumbs.length > 0);
                  const shared = large && item.member_count > 0;
                  return (
                    <CardMemory
                      title={item.title}
                      meta={[
                        formatEventDates(item.event_start, item.event_end),
                        s.memory.frames(item.media_count),
                      ].filter(Boolean)}
                      thumbs={thumbs}
                      cover={cover}
                      large={large}
                      organizer={
                        item.role === 'organizer' ? (
                          <BadgeOrganizer label={s.role.organizer} />
                        ) : undefined
                      }
                      films={
                        item.montage_count > 0 ? (
                          <BadgeFilms label={s.montage.count(item.montage_count)} filled={large} />
                        ) : undefined
                      }
                      progress={
                        shared ? item.contributed_member_count / item.member_count : undefined
                      }
                      progressLabel={
                        shared
                          ? s.home.brought(item.contributed_member_count, item.member_count)
                          : undefined
                      }
                      emptyText={item.media_count === 0 ? s.home.noFrames : s.state.preparing}
                      onPress={() =>
                        router.push({ pathname: '/memory/[id]', params: { id: item.id } })
                      }
                    />
                  );
                }}
              />
            )
      }
    >
      {memories !== null ? null : failed === null ? (
        <Waiting text={s.state.gathering} />
      ) : (
        <Empty icon={WifiOff} text={failed}>
          <Button label={s.action.retry} variant="small" onPress={load} />
        </Empty>
      )}
    </Board>
  );
}
const styles = StyleSheet.create({
  body: { paddingHorizontal: space.s4 },
  lead: { paddingTop: board.bodyMain - board.status - height.bar },
  leadBanner: { paddingTop: board.bannerMain - board.status - height.bar },
  list: { flexGrow: 1, gap: space.s3, paddingBottom: space.s5 },
  mid: { justifyContent: 'center' },
  edge: { marginHorizontal: -space.s4 },
});
