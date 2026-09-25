import { useRouter } from 'expo-router';
import { Clock, PanelsTopLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { listMemories, type MontagePreview, orderMontage, previewMontage } from '@/api';
import {
  Banner,
  BlockSummary,
  Button,
  ICO_S,
  Icon,
  PosterOrder,
  SummarySection,
  SummaryShots,
  SummaryTrack,
  Text,
  Waiting,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatRuntime } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import { RATIO, shelfTrack, taken, wishes } from '@/lib/montage/order';
import {
  type Refusal,
  refusal,
  TEMPLATE_SIGN,
  useOrder,
  useStillHere,
  WizardStep,
} from '@/screens/order/wizard';
import { space, themed, useTheme, wizardLead } from '@/theme';

/**
 * The summary, `MontageSummary` (spec 8) — the order read back and then spent. The poster of the
 * film that does not exist yet, the three sections of what was asked for, the wait in minutes, and
 * the one button.
 *
 * Nothing on this screen can be edited, and that is the whole of its design: the way to change an
 * answer is «Назад» to the step that gave it, because a field here would be a second place where
 * the same thing is decided — and the summary would then be a summary of something else.
 *
 * Every number on it is the api's: how many photos, how many videos, how many people and how long
 * the making takes all come from one `previewMontage` call, made with the very body the order
 * sends. The phone counts none of it (doc-03) — a summary worked out on this side could agree to
 * something the order would then turn down, which is worse than no summary at all.
 */
export default function SummaryStep() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const { id, items, reread, material, order } = useOrder();
  const { color } = useTheme();
  const styles = useStyles();
  const [preview, setPreview] = useState<MontagePreview | null>(null);
  /** The api refused to total the order at all — there is nothing to show and somewhere to go. */
  const [stopped, setStopped] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const gone = useStillHere();
  const inMovie = taken(material, order);
  const shots = inMovie.map((item) => item.thumbnail_url).filter((uri) => uri !== null);

  /**
   * The total of the order as it stands, asked again whenever it moves. Nothing on this screen
   * changes it, but step 4 under it can: after the autopilot the length is held back into range
   * there only once its own answer lands, which may be after this screen has already asked. Until
   * the total of the order as it now is comes back there is no button, so what is pressed is always
   * what was totalled.
   */
  useEffect(() => {
    if (!token || items === null) return;
    let here = true;
    setPreview(null);
    setStopped(null);
    previewMontage(token, id, wishes(items, order)).then(
      (came) => {
        if (here) setPreview(came);
      },
      (e: unknown) => {
        if (here) setStopped(refusal(e));
      },
    );
    return () => {
      here = false;
    };
  }, [token, items, id, order]);

  // The memory's own name, for the corner of the poster — off the listing every screen of a memory
  // reads, the way the waiting screen after the order reads it. A failure here is left unsaid: the
  // poster has its shape and its length to show, and the name is the smallest thing on it.
  useEffect(() => {
    if (!token) return;
    listMemories(token).then(
      (memories) => setTitle(memories.find((one) => one.id === id)?.title ?? null),
      () => {},
    );
  }, [token, id]);

  /** The one call the whole wizard leads to: everything the four steps settled, in one body. */
  async function send() {
    // The second tap of a double tap lands here while the first is still in flight — the button is
    // already spinning and disabled, and this is the guard for the press that got in anyway.
    if (!token || items === null || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const made = await orderMontage(token, id, wishes(items, order));
      // Left while it was in flight: the order is placed and cannot be unsent, but the screen that
      // asked for it is not here to lead anywhere — the list on the memory is where it shows up.
      if (gone.current) return;
      // Onto the waiting for this one montage, and `replace` rather than `push`: the order is sent,
      // so the steps behind this screen are not somewhere to go back to — what is under the waiting
      // is the memory it was ordered from. The count of frames goes along because the wizard is the
      // only one who ever counts them; the api hands back what it wrote and not how many pictures
      // it adds up to.
      router.replace({
        pathname: '/memory/[id]/montage/[montageId]',
        params: { id, montageId: made.id, frames: inMovie.length },
      });
    } catch (e) {
      if (gone.current) return;
      // The material can fall under the floor between the summary and this call — somebody else
      // deleting what the order was counting on. The line says what happened; the button comes
      // back, because the order was not placed.
      setNotice(refusal(e).text);
      setBusy(false);
    }
  }

  /**
   * Straight to the step that can undo a refusal, however many steps of the walk are behind — and
   * with the material read again: a refusal is the api saying it moved under the order, and the
   * step would otherwise offer the frames and the range it was just refused for.
   */
  const goBackTo = (step: Refusal['back']) => {
    reread();
    router.dismissTo(
      step === 'frames'
        ? { pathname: '/memory/[id]/order/frames', params: { id } }
        : { pathname: '/memory/[id]/order/build', params: { id } },
    );
  };

  const story = order.story.trim();
  const template = order.template;

  return (
    <WizardStep
      step="summary"
      title={s.montage.summaryTitle}
      notice={notice}
      action={
        preview === null ? undefined : (
          <Button
            variant="primary"
            wide
            icon={PanelsTopLeft}
            label={s.montage.startCut}
            busy={busy}
            onPress={() => void send()}
          />
        )
      }
      body={stopped === null && preview !== null ? styles.body : undefined}
    >
      {stopped !== null ? (
        // Refused, and said in words with the way out of it under them — never the empty screen a
        // summary of nothing would be. Where no step can undo it — the network, the api falling
        // over — the way out is asking again, off a fresh read of the material, so the body is the
        // order as it stands then and never the one that failed.
        <Banner tone="error" text={stopped.text} style={styles.banner}>
          {stopped.back === null ? (
            <Button size="xs" variant="quiet" label={s.action.retry} onPress={reread} />
          ) : (
            <Button
              size="xs"
              variant="quiet"
              label={stopped.back === 'frames' ? s.montage.toFrames : s.montage.toLength}
              onPress={() => goBackTo(stopped.back)}
            />
          )}
        </Banner>
      ) : preview === null ? (
        <View style={styles.middle}>
          <Waiting text={s.state.loading} />
        </View>
      ) : (
        <>
          {/* The poster of the film that has been asked for: its first three frames, the template
              it is cut to, and the length the api settled printed big. */}
          <PosterOrder
            photos={shots.slice(0, 3)}
            template={template === null ? undefined : s.montage.template[template]}
            templateIcon={template === null ? undefined : TEMPLATE_SIGN[template]}
            length={formatRuntime(preview.target_seconds) ?? ''}
            shape={s.montage.orientation[preview.orientation]}
            about={[RATIO[preview.orientation], title].filter(Boolean).join(' · ')}
          />

          <BlockSummary>
            <SummarySection title={s.memory.framesPlain}>
              <View style={styles.counts}>
                <Text role="row">{s.montage.shots(preview.photos, preview.videos)}</Text>
                <Text role="meta">{s.montage.byPeople(preview.people)}</Text>
              </View>
              <SummaryShots photos={shots} />
            </SummarySection>

            {/* Four lines of it and no more: the whole story was read on the step that wrote it,
                and here it is being recognised rather than read again. Nothing written is the
                director deciding, which is a state of the order and not an empty section. Quoted
                back, so in the quote's own shade (spec 7.6, detail 43: 13 / 400 / 19, #D8D5E0). */}
            <SummarySection title={s.montage.story} divider>
              <Text role="quote" tone="quote" numberOfLines={4}>
                {story === '' ? s.montage.directorDecides : story}
              </Text>
            </SummarySection>

            <SummarySection title={s.montage.music} divider>
              {order.tracks.length === 0 ? (
                <Text role="row" tone="muted">
                  {s.montage.noMusicLive}
                </Text>
              ) : (
                order.tracks.map((track, i) => {
                  const shelf = shelfTrack(track.key);
                  return (
                    <SummaryTrack
                      key={track.key}
                      title={
                        shelf === null
                          ? (track.name ?? s.montage.ownTrackShort)
                          : s.montage.track[shelf]
                      }
                      // What the music does to the cut, said once over the list and not on every
                      // row of it — it is one sentence about the film, not a property of a track.
                      note={i === 0 ? s.montage.onTheBeat : undefined}
                    />
                  );
                })
              )}
            </SummarySection>
          </BlockSummary>

          <View style={styles.wait}>
            <Icon icon={Clock} size={ICO_S} color={color.faint} />
            <Text role="aside" tone="muted" style={styles.grow}>
              {s.montage.readyIn(preview.estimate_minutes)}
            </Text>
          </View>
        </>
      )}
    </WizardStep>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    middle: { flexGrow: 1, justifyContent: 'center' },
    banner: { marginHorizontal: space.s4 },
    body: {
      flexGrow: 1,
      paddingHorizontal: space.s4,
      paddingTop: wizardLead.total,
      paddingBottom: space.s6,
      gap: space.s3,
    },
    counts: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
    // The line with the clock stands just inside the cards above it, as the layout draws it.
    wait: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: space.s1,
    },
  }),
);
