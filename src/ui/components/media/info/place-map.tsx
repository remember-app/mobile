import { MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/ui/kit/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

export type Place = {
  latitude: number;
  longitude: number;
  label: string;
};

export function PlaceMap({ place }: { place: Place | null }) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const styles = useStyles();
  if (!place) {
    return (
      <View style={[styles.map, styles.empty]}>
        <Text role="noteSm" style={styles.faint}>
          {t('photo.noPlace')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.map}>
      <View style={[styles.road, styles.roadA]} />
      <View style={[styles.road, styles.roadB]} />
      <View style={[styles.road, styles.roadC]} />
      <View style={[styles.road, styles.roadD]} />
      <View style={styles.pin}>
        <MapPin size={22} color={color.accentText} fill={color.accentSoft} />
      </View>
      <View style={styles.label}>
        <Text role="noteSm" style={styles.paper}>
          {place.label}
        </Text>
      </View>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    map: {
      height: 150,
      borderRadius: radius.card,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    road: {
      position: 'absolute',
      backgroundColor: color.line,
    },
    roadA: {
      left: -30,
      right: -30,
      top: 46,
      height: 1,
      transform: [{ rotate: '-7deg' }],
    },
    roadB: {
      left: -30,
      right: -30,
      top: 96,
      height: 1,
      transform: [{ rotate: '4deg' }],
    },
    roadC: {
      top: -30,
      bottom: -30,
      left: 90,
      width: 1,
      transform: [{ rotate: '9deg' }],
    },
    roadD: {
      top: -30,
      bottom: -30,
      left: 230,
      width: 1,
      transform: [{ rotate: '-5deg' }],
    },
    pin: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginLeft: -11,
      marginTop: -11,
    },
    faint: {
      color: color.faint,
    },
    paper: {
      color: color.paper,
    },
    label: {
      position: 'absolute',
      left: space.s3,
      bottom: space.s3,
      paddingHorizontal: space.s2,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: color.coverBase,
    },
  }),
);
