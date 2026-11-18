import { RectangleHorizontal, RectangleVertical } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { DescriptionField } from '@/ui/components/forms/description-field';
import { duration } from '@/ui/format';
import { Field } from '@/ui/kit/controls/field';
import { Segment } from '@/ui/kit/controls/segment';
import { Slider } from '@/ui/kit/controls/slider';
import { themed } from '@/ui/theme';

import { type Change, type Draft, OrderPage, OrderScroll, type Orientation } from './wizard';

export function MetaPage({
  draft,
  defaultName,
  eventDescription,
  onEventDescription,
  onEventDescriptionDone,
  onChange,
  width,
  height,
  top,
  bottom,
}: {
  draft: Draft;
  defaultName: string;
  eventDescription: string;
  onEventDescription: (value: string) => void;
  onEventDescriptionDone: () => void;
  onChange: Change;
  width: number;
  height: number;
  top: number;
  bottom: number;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <OrderPage width={width} height={height}>
      <OrderScroll top={top} bottom={bottom}>
        <Field
          label={t('montage.order.movieName')}
          value={draft.name}
          onChangeText={(name) => onChange({ name })}
          placeholder={defaultName}
          maxLength={200}
        />
        <DescriptionField
          value={eventDescription}
          onChangeText={onEventDescription}
          onEndEditing={onEventDescriptionDone}
        />
        <Field
          label={t('montage.order.promptTitle')}
          value={draft.prompt}
          onChangeText={(prompt) => onChange({ prompt })}
          placeholder={t('montage.order.promptPlaceholder')}
          multiline
          scrollEnabled={false}
          maxLength={4000}
          style={styles.note}
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
    note: {
      textAlignVertical: 'top',
    },
  }),
);
