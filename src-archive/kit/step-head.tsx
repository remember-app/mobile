import { Image } from 'expo-image';
import { Check, Play } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { faces, photo, radius, space, themed, useTheme } from '@/theme';
import { BackButton } from './button';
import { Icon, playFor } from './icon';
import { Text } from './text';

type Shot = string | number;
export function StepHead({
  art,
  title,
  lead,
  first,
  back,
  children,
}: {
  art: ReactNode;
  title: string;
  lead: string;
  first?: boolean;
  back?: {
    label: string;
    onPress: () => void;
  };
  children?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View>
      <View style={children ? styles.head : null}>
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

      {back ? (
        <View style={styles.back}>
          <BackButton label={back.label} onPress={back.onPress} />
        </View>
      ) : null}
    </View>
  );
}
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
const PEOPLE = [
  { face: faces[0], name: 118, meta: 70, picked: true },
  { face: faces[2], name: 94, meta: 56, picked: false },
  { face: faces[3], name: 132, meta: 79, picked: false },
] as const;
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
