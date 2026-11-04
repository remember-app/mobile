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
  NameHeading,
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
import { FilmNameSheet } from '@/screens/memory/film-info';
import {
  type Refusal,
  refusal,
  TEMPLATE_SIGN,
  useOrder,
  useStillHere,
  WizardStep,
} from '@/screens/order/wizard';
import { space, themed, useTheme, wizardLead } from '@/theme';
export default function SummaryStep() {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const { id, items, reread, material, order } = useOrder();
  const { color } = useTheme();
  const styles = useStyles();
  const [preview, setPreview] = useState<MontagePreview | null>(null);
  const [stopped, setStopped] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [named, setNamed] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const gone = useStillHere();
  const inMovie = taken(material, order);
  const shots = inMovie.map((item) => item.thumbnail_url).filter((uri) => uri !== null);
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
  useEffect(() => {
    if (!token) return;
    listMemories(token).then(
      (memories) => setTitle(memories.find((one) => one.id === id)?.title ?? null),
      () => {},
    );
  }, [token, id]);
  async function send() {
    if (!token || items === null || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const made = await orderMontage(token, id, {
        ...wishes(items, order),
        ...(template === null ? {} : { template }),
        ...(sent === null ? {} : { name: sent }),
      });
      if (gone.current) return;
      router.replace({
        pathname: '/memory/[id]/montage/[montageId]',
        params: { id, montageId: made.id, frames: inMovie.length },
      });
    } catch (e) {
      if (gone.current) return;
      setNotice(refusal(e).text);
      setBusy(false);
    }
  }
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
  const sent = named ?? (template === null ? null : s.montage.defaultName[template]);
  const shown =
    preview === null
      ? null
      : (sent ?? s.montage.ofLength(formatRuntime(preview.target_seconds) ?? ''));
  return (
    <WizardStep
      step="summary"
      named={
        shown === null ? undefined : (
          <NameHeading
            name={shown}
            label={s.montage.film.renameNow(shown)}
            onPress={() => setRenaming(true)}
            style={styles.name}
          />
        )
      }
      notice={notice}
      action={
        preview === null ? undefined : (
          <Button
            variant="primary"
            wide
            icon={PanelsTopLeft}
            glyph={{ size: 19, stroke: 1.9 }}
            label={s.montage.startCut}
            busy={busy}
            onPress={() => void send()}
          />
        )
      }
      body={stopped === null && preview !== null ? styles.body : undefined}
    >
      {stopped !== null ? (
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

            <SummarySection title={s.montage.story} divider>
              <Text role="quote" tone="quote" numberOfLines={4}>
                {story === '' ? s.montage.directorDecides : story}
              </Text>
            </SummarySection>

            <SummarySection title={s.montage.music} divider>
              {order.director ? (
                <Text role="row">{s.montage.directorChoice}</Text>
              ) : order.tracks.length === 0 ? (
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

          {renaming && shown !== null ? (
            <FilmNameSheet
              name={shown}
              onSave={(next) => {
                setNamed(next);
                setRenaming(false);
              }}
              onClose={() => setRenaming(false)}
            />
          ) : null}
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
    name: { marginTop: 10, marginHorizontal: space.s4 },
    body: {
      flexGrow: 1,
      paddingHorizontal: space.s4,
      paddingTop: wizardLead.total,
      paddingBottom: space.s6,
      gap: space.s3,
    },
    counts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.s2 },
    wait: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: space.s1,
    },
  }),
);
