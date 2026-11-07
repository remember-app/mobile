import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { i18n, locale } from '@/ui/i18n';
import { Text } from '@/ui/kit/text';
import { radius, space, themed } from '@/ui/theme';

import type { Place } from './place-map';

export type PhotoMeta = {
  capturedAt: Date;
  cameraModel: string;
  format: string;
  lens: string;
  standard: boolean;
  width: number;
  height: number;
  bytes: number;
  iso: number | null;
  focalLengthMm: number | null;
  ev: number | null;
  aperture: number | null;
  shutter: string | null;
  place: Place | null;
};

function dateText(date: Date): string {
  const text = new Intl.DateTimeFormat(locale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function decimal(value: number): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(value);
}

function megabytes(bytes: number): string {
  return `${decimal(bytes / 1024 / 1024)} ${i18n.t('unit.mb')}`;
}

export function MetaCard({ meta, onEdit }: { meta: PhotoMeta; onEdit?: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const focal = meta.focalLengthMm === null ? null : `${meta.focalLengthMm} mm`;
  const aperture = meta.aperture === null ? null : `ƒ${decimal(meta.aperture)}`;
  const optics = [focal, aperture].filter(Boolean).join(' ');
  const lens = meta.lens ? (optics ? `${meta.lens} — ${optics}` : meta.lens) : optics;
  const megapixels = Math.round((meta.width * meta.height) / 1_000_000);
  const detail = `${megapixels} ${t('unit.megapixels')} · ${meta.width} × ${meta.height} · ${megabytes(meta.bytes)}`;
  const exposure = [
    meta.iso === null ? null : `ISO ${meta.iso}`,
    focal,
    meta.ev === null ? null : `${meta.ev} ev`,
    aperture,
    meta.shutter,
  ].filter((part): part is string => part !== null);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text role="row" numberOfLines={1} style={[styles.grow, styles.paper]}>
          {dateText(meta.capturedAt)}
        </Text>
        {onEdit ? (
          <Pressable accessibilityRole="button" hitSlop={10} onPress={onEdit}>
            <Text role="controlSm" style={styles.accent}>
              {t('photo.edit')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text role="subtitle" numberOfLines={1} style={[styles.grow, styles.paper]}>
          {meta.cameraModel}
        </Text>
        <Chip text={meta.format} />
      </View>
      <View style={styles.divider} />
      <View style={styles.block}>
        <View style={styles.blockRow}>
          <View style={styles.lines}>
            <Text role="bodySm" style={styles.muted}>
              {lens}
            </Text>
            <Text role="bodySm" style={styles.muted}>
              {detail}
            </Text>
          </View>
          {meta.standard ? <Chip text={t('photo.standard')} /> : null}
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.exposure}>
        {exposure.map((part, index) => (
          <View key={part} style={[styles.exposureCell, index > 0 ? styles.exposureLine : null]}>
            <Text role="meta" style={styles.muted}>
              {part}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Chip({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.chip}>
      <Text role="metaSm" style={styles.paper}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.card,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
      paddingVertical: space.s3,
    },
    grow: {
      flex: 1,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: color.line,
    },
    block: {
      paddingHorizontal: space.s4,
      paddingVertical: space.s3,
    },
    blockRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.s3,
    },
    lines: {
      flex: 1,
      gap: 2,
    },
    chip: {
      height: 28,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color.raise,
    },
    exposure: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    exposureCell: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    exposureLine: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: color.line,
    },
    paper: {
      color: color.paper,
    },
    muted: {
      color: color.muted,
    },
    accent: {
      color: color.accentText,
    },
  }),
);
