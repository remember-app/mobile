import { RectangleHorizontal, RectangleVertical } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { duration } from '@/ui/format';
import { Field } from '@/ui/kit/field';
import { Segment } from '@/ui/kit/segment';
import { Slider } from '@/ui/kit/slider';
import { space, themed } from '@/ui/theme';

import { type Change, type Draft, OrderPage, OrderScroll, type Orientation } from './wizard';

export function MetaPage({
  draft,
  projectTitle,
  onChange,
  width,
  height,
  bottom,
}: {
  draft: Draft;
  projectTitle: string;
  onChange: Change;
  width: number;
  height: number;
  bottom: number;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <OrderPage width={width} height={height}>
      <OrderScroll bottom={bottom}>
        <Field
          label={t('montage.order.movieName')}
          value={draft.name}
          onChangeText={(name) => onChange({ name })}
          placeholder={projectTitle}
          maxLength={200}
        />
        <Field
          label={t('montage.order.promptTitle')}
          value={draft.prompt}
          onChangeText={(prompt) => onChange({ prompt })}
          placeholder={t('montage.order.promptPlaceholder')}
          multiline
          maxLength={4000}
          style={styles.area}
        />
        <Slider
          label={t('montage.order.duration')}
          value={draft.targetSeconds}
          onChange={(targetSeconds) => onChange({ targetSeconds })}
          min={10}
          max={180}
          valueLabel={duration(draft.targetSeconds)}
          minLabel={duration(10)}
          maxLabel={duration(180)}
        />
        <Segment<Orientation>
          label={t('montage.order.orientation')}
          hideLabel
          options={[
            {
              value: 'portrait',
              label: t('montage.order.vertical'),
              icon: RectangleVertical,
            },
            {
              value: 'landscape',
              label: t('montage.order.horizontal'),
              icon: RectangleHorizontal,
            },
          ]}
          value={draft.orientation}
          onChange={(orientation) => onChange({ orientation })}
        />
      </OrderScroll>
    </OrderPage>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    area: {
      minHeight: 120,
      textAlignVertical: 'top',
      paddingTop: space.s3,
    },
  }),
);
