import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, Plus, User, WifiOff, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { errorMessage, listMemories, type Memory } from '@/api';
import { useAuth } from '@/auth';
import { formatEventDates } from '@/dates';
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
  Waiting,
} from '@/kit';
import { useStrings } from '@/language';
import { duration, height, space } from '@/theme';

/**
 * Where the connection stands, as this screen draws it (spec, «Ожидание и отказы»): the list is the
 * screen and the connection is a line above it, never a replacement for what is on it. `hushed` is
 * that same line put away by hand — the message left, the connection did not come back, so the
 * `spark` one is still owed when it does.
 */
type Link = { at: 'ok' | 'back' } | { at: 'gone' | 'hushed'; why: string };

/** Spec 8, `Main` — every memory this account organizes or was invited to. */
export default function HomeScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  // null means «not loaded yet», which is what tells a first load from a refetch: a refetch keeps
  // the list on screen instead of flashing the spinner over it — and a *failed* refetch keeps it
  // too, which is the whole of `HomeOffline`.
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [link, setLink] = useState<Link>({ at: 'ok' });

  const load = useCallback(() => {
    if (!token) return;
    listMemories(token).then(
      (list) => {
        setMemories(list);
        // «Соединение установлено» is owed only to somebody who watched it go — and the same object
        // back otherwise, so a refetch while the banner stands does not restart its three seconds.
        setLink((was) => (was.at === 'gone' || was.at === 'hushed' ? { at: 'back' } : was));
      },
      (e: unknown) => setLink({ at: 'gone', why: errorMessage(e) }),
    );
  }, [token]);

  // On focus rather than on mount, so coming back from /create shows the memory that was just made
  // without this screen having to know that anything happened.
  useFocusEffect(load);

  // Spec 7.6: the `done` banner carries no button at all, because it is already going. This is it
  // going — the one thing on the screen that happens without anybody doing anything.
  useEffect(() => {
    if (link.at !== 'back') return;
    const leaves = setTimeout(() => setLink({ at: 'ok' }), duration.hold);
    return () => clearTimeout(leaves);
  }, [link]);

  const failed = link.at === 'gone' || link.at === 'hushed' ? link.why : null;

  return (
    <Board>
      <AppBar
        variant="root"
        title={s.home.title}
        // Spec 8: one button on the main screen and it is the account. The contact list used to have
        // a second one here and lives inside the account now, so this is the only way out of the list.
        right={
          <IconButton
            icon={User}
            label={s.home.account}
            // Spec 7.2: the 44 in a root bar is `surface` over `line`, and the glyph on it is read
            // in `paper` — which the tone itself now carries.
            tone="surface"
            onPress={() => router.push('/profile')}
          />
        }
      />

      {memories === null ? (
        <View style={[styles.body, styles.place, styles.mid]}>
          {failed === null ? (
            // `HomeLoading`: waiting holds the place of the list rather than blinking over it.
            <Waiting text={s.state.gathering} />
          ) : (
            // Nothing held and nothing arrived. The failure takes the place of the list, because
            // the empty state under it would read as «you have no memories», which is not known.
            <Empty icon={WifiOff} text={failed}>
              <Button label={s.action.retry} variant="small" onPress={load} />
            </Empty>
          )}
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(memory) => memory.id}
          contentContainerStyle={[
            styles.body,
            styles.list,
            memories.length === 0 ? styles.mid : null,
          ]}
          // The banner is the first thing in the body and pushes the cards down (spec 7.6): it is
          // about what is under it, so it never lies over it.
          ListHeaderComponent={
            link.at === 'gone' ? (
              <Banner text={s.home.offline}>
                <IconButton
                  icon={X}
                  label={s.action.hide}
                  size={height.roundTiny}
                  tone="danger"
                  onPress={() => setLink({ at: 'hushed', why: link.why })}
                />
              </Banner>
            ) : link.at === 'back' ? (
              <Banner tone="done" text={s.home.online} />
            ) : null
          }
          // `HomeEmpty`: nothing to list is an invitation standing in the middle of the body, where
          // a stack of cards would otherwise start at the top of it.
          ListEmptyComponent={
            <Empty sign="spark" icon={Camera} title={s.home.emptyTitle} text={s.home.empty} />
          }
          renderItem={({ item, index }) => {
            // `?? []` and not a bare read: the app ships over the air and the api deploys on its
            // own, so a build that knows this field can meet one that does not. Every other new
            // field degrades quietly under that skew — this one would throw inside the list
            // renderer and take the main screen down with it.
            const thumbs = item.recent_thumbnail_urls ?? [];
            // Spec 8: the freshest memory leads the list on the large card — but that card *is* a
            // photograph with a name across it, so a memory with nothing in it yet takes the
            // ordinary one and its dashed film, exactly as `Main` draws «Корпоратив Nox».
            const large = index === 0 && thumbs.length > 0;
            // The bar of who has already brought theirs, off the summary the listing itself counted
            // (doc-06) — no request per card. An api too old to send it draws no bar at all, rather
            // than a full one over «0 из 0».
            const shared = large && item.member_count > 0;

            return (
              <CardMemory
                title={item.title}
                // «12–14 сентября · 486 кадров». A day that will not parse writes nothing, and a
                // dot with nothing on one side of it is worse than one fact alone.
                meta={[
                  formatEventDates(item.event_start, item.event_end),
                  s.memory.frames(item.media_count),
                ].filter(Boolean)}
                // The frames the listing signed for this memory, drawn as they come: the card shows
                // what is inside instead of counting it.
                thumbs={thumbs}
                // The frame the organizer put up as this memory's face (spec 10.8.3): on the large
                // card it takes the whole of it instead of the mosaic, on the ordinary one it leads
                // the strip. Nobody chose one and both cards are exactly what they were.
                cover={item.cover_thumbnail_url}
                large={large}
                organizer={
                  item.role === 'organizer' ? (
                    <BadgeOrganizer label={s.role.organizer} />
                  ) : undefined
                }
                // Spec 7.6 — filled over a cover, outlined on a surface.
                films={
                  item.montage_count > 0 ? (
                    <BadgeFilms label={s.montage.count(item.montage_count)} filled={large} />
                  ) : undefined
                }
                progress={shared ? item.contributed_member_count / item.member_count : undefined}
                progressLabel={
                  shared
                    ? s.home.brought(item.contributed_member_count, item.member_count)
                    : undefined
                }
                // Two different silences, and they must not be worded the same. A memory with
                // nothing in it is waiting for the first frame. A memory that has a hundred but
                // signed no thumbnail — the worker has not made them yet, the api has no bucket,
                // or the build is older than the field — is not empty, and telling that person to
                // add the first ones would be a lie the meta line beside it contradicts.
                emptyText={item.media_count === 0 ? s.home.noFrames : s.state.preparing}
                // Straight to the material: what a memory is for is the photos in it, so the card
                // opens the memory on its first face. The movies and the people are the other two,
                // one press away on the switch under its name.
                onPress={() => router.push({ pathname: '/memory/[id]', params: { id: item.id } })}
              />
            );
          }}
        />
      )}

      <ActionBar>
        <Button
          label={s.home.create}
          variant="primary"
          icon={Plus}
          wide
          // `HomeLoading`: the one action of the screen keeps its place and is simply not available
          // while the list is still on its way.
          disabled={memories === null && failed === null}
          onPress={() => router.push('/create')}
        />
      </ActionBar>
    </Board>
  );
}

// Shape only: the board, the cards and the bottom layer each carry their own colours.
const styles = StyleSheet.create({
  // Spec 7.1 — the 16 at the side belongs to each belt of the screen and not to the board around
  // them: held once around all three, the footer's gradient would stop 16 short of either edge.
  body: { paddingHorizontal: space.s4 },
  // Cards a 12 gap apart, 16 under the bar, and the list keeps the full height so its empty state
  // has somewhere to stand.
  list: { flexGrow: 1, gap: space.s3, paddingTop: space.s4, paddingBottom: space.s5 },
  place: { flex: 1 },
  // A body with nothing to scroll holds what it has in the middle.
  mid: { justifyContent: 'center' },
});
