import { Image } from 'expo-image';
import { Check, Play } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { faces, photo, radius, space, themed, useTheme } from '@/theme';

import { BackButton } from './button';
import { Icon, playFor } from './icon';
import { Text } from './text';

/** A url, or a picture that ships with the app — the way in stands before there are any frames. */
type Shot = string | number;

/**
 * Spec 7.1, detail 76 — the head of an onboarding step: a picture, a heading and a lead, and the
 * five of them together tell in short what the app is. It stands where it is drawn and never moves
 * — not when a field takes the caret, not when the keyboard comes up; only the step's main button
 * rides the keyboard. On a phone too low for that the body scrolls, and the head goes up whole.
 *
 * Every place is measured from the device's status line — the layout's 52: «Назад» 18 under it, the
 * picture 60, the heading 12 under the picture's 90 (16 under the first step's 176), and the block of
 * the field (`children`) at 312 of the layout — 16 under the lead at the least, when the words run
 * long on a narrow phone or large type.
 */
export function StepHead({
  art,
  title,
  lead,
  first,
  back,
  children,
}: {
  /** The picture: the stack on the first step, one of the four below on the rest. */
  art: ReactNode;
  title: string;
  lead: string;
  /** Step 1: «Remember» in `hero` over the promise, the picture 176 tall, and no way back. */
  first?: boolean;
  /** «Назад» — its word and where it leads; steps 2–5. */
  back?: { label: string; onPress: () => void };
  /** The block of the field. */
  children?: ReactNode;
}) {
  const styles = useStyles();

  return (
    <View>
      <View style={children ? styles.head : null}>
        {/* Drawn from tokens, not data: nothing in it is read out. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.art, first ? styles.artFirst : null]}
        >
          {art}
        </View>
        <View style={[styles.words, first ? styles.wordsFirst : null]}>
          <Text role={first ? 'hero' : 'display'} accessibilityRole="header" style={styles.centre}>
            {title}
          </Text>
          <Text role={first ? 'body' : 'lead'} tone="muted" style={styles.centre}>
            {lead}
          </Text>
        </View>
      </View>
      {children ? <View style={styles.block}>{children}</View> : null}
      {/* Over the picture rather than in a row of its own, which would push everything under it 44
          down. Last, so it lies above what it floats over. */}
      {back ? (
        <View style={styles.back}>
          <BackButton label={back.label} onPress={back.onPress} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Step 2, «общая лента»: a card of six frames three by two, and on its lower right corner three
 * empty faces — frames from different people, in one place.
 */
export function FeedArt({ photos }: { photos: readonly Shot[] }) {
  const styles = useStyles();

  return (
    <View>
      <View style={styles.feed}>
        {photos.slice(0, 6).map((shot, i) => (
          <Image key={i} source={shot} contentFit="cover" style={styles.feedShot} />
        ))}
      </View>
      <View style={styles.feedFaces}>
        {[faces[1], faces[2], faces[3]].map((fill, i) => (
          <View
            key={fill}
            style={[styles.feedFace, i > 0 ? styles.feedOver : null, { backgroundColor: fill }]}
          />
        ))}
      </View>
    </View>
  );
}

/** Step 3, «ролик»: a frame with the play circle on it and a track under it, a third played. */
export function FilmArt({ photo: shot }: { photo: Shot }) {
  const styles = useStyles();
  const { color } = useTheme();

  return (
    <View style={styles.frame}>
      <Image source={shot} contentFit="cover" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.filmDark]} />
      <View style={styles.filmPlay}>
        <Icon icon={Play} size={playFor(15)} color={color.ink} fill={color.ink} />
      </View>
      <View style={styles.filmTrack}>
        <View style={styles.filmPlayed} />
      </View>
    </View>
  );
}

/** Step 4, «лица»: a frame with two `spark` squares on it — how the network sees the faces. */
export function FacesArt({ photo: shot }: { photo: Shot }) {
  const styles = useStyles();

  return (
    <View style={styles.frame}>
      <Image source={shot} contentFit="cover" style={StyleSheet.absoluteFill} />
      <View style={[styles.face, styles.faceOne]} />
      <View style={[styles.face, styles.faceTwo]} />
    </View>
  );
}

/** The three rows of «люди»: whose face, how long the two strokes of words are, whether picked. */
const PEOPLE = [
  { face: faces[0], name: 118, meta: 70, picked: true },
  { face: faces[2], name: 94, meta: 56, picked: false },
  { face: faces[3], name: 132, meta: 79, picked: false },
] as const;

/**
 * Step 5, «люди»: three rows of a list with no words in them, the first one picked — a person is
 * called into a memory by picking them, not by typing their name.
 */
export function PeopleArt() {
  const styles = useStyles();
  const { color } = useTheme();

  return (
    <View style={styles.people}>
      {PEOPLE.map((one) => (
        <View key={one.face} style={styles.person}>
          <View style={[styles.personFace, { backgroundColor: one.face }]} />
          <View style={styles.personWords}>
            <View style={[styles.personName, { width: one.name }]} />
            <View style={[styles.personMeta, { width: one.meta }]} />
          </View>
          {one.picked ? (
            <View style={[styles.pick, styles.picked]}>
              <Icon icon={Check} size={11} stroke={3} color={color.sparkInk} />
            </View>
          ) : (
            <View style={[styles.pick, styles.unpicked]} />
          )}
        </View>
      ))}
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    // The block of the field stands at 312 of the layout, 16 under this.
    head: { minHeight: 312 - 52 - space.s4 },
    art: { height: 90, marginTop: 60, alignItems: 'center' },
    artFirst: { height: 176 },
    words: { marginTop: space.s3, paddingHorizontal: space.s6, alignItems: 'center', gap: 10 },
    wordsFirst: { marginTop: space.s4 },
    centre: { textAlign: 'center' },
    block: { marginTop: space.s4, paddingHorizontal: space.s4 },
    back: { position: 'absolute', left: 10, top: 18 },
    feed: {
      width: 3 * 70 + 2 * 4 + 2 * 5 + 2,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      padding: 5,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
    feedShot: { width: 70, height: 43, borderRadius: 8 },
    // The faces are 28 with a ring of 3 in the screen's own ink round them, 10 over each other; the
    // ring is drawn inside, so the boxes are 34 and 16 over, 3 nearer the card's corner than 6 / −11.
    feedFaces: { position: 'absolute', right: 3, bottom: -14, flexDirection: 'row' },
    feedFace: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      borderWidth: 3,
      borderColor: color.ink,
    },
    feedOver: { marginLeft: -16 },
    frame: {
      width: 224,
      height: 90,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.line,
      overflow: 'hidden',
    },
    filmDark: { experimental_backgroundImage: photo.filmArt },
    filmPlay: {
      position: 'absolute',
      top: 26,
      alignSelf: 'center',
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: color.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filmTrack: {
      position: 'absolute',
      left: space.s3,
      right: space.s3,
      bottom: space.s3,
      height: 3,
      borderRadius: radius.pill,
      backgroundColor: photo.filmArtTrack,
    },
    filmPlayed: {
      width: '38%',
      height: 3,
      borderRadius: radius.pill,
      backgroundColor: color.spark,
    },
    face: { position: 'absolute', borderWidth: 2, borderColor: color.spark, borderRadius: 8 },
    faceOne: { left: 38, top: 20, width: 44, height: 44 },
    faceTwo: { left: 132, top: 30, width: 38, height: 38 },
    people: {
      width: 224,
      gap: 9,
      paddingVertical: space.s3,
      paddingHorizontal: 14,
      borderRadius: radius.cell,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
    },
    person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    personFace: { width: 24, height: 24, borderRadius: radius.pill },
    personWords: { flex: 1, gap: 4 },
    personName: {
      maxWidth: '100%',
      height: 7,
      borderRadius: radius.pill,
      backgroundColor: color.lineQuiet,
    },
    personMeta: {
      maxWidth: '100%',
      height: 5,
      borderRadius: radius.pill,
      backgroundColor: color.raise,
    },
    pick: {
      width: 20,
      height: 20,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    picked: { backgroundColor: color.spark },
    unpicked: { borderWidth: 1.5, borderColor: color.lineQuiet },
  }),
);
