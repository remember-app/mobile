import { RectangleHorizontal, RectangleVertical } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { CaptionField } from '@/ui/components/media/info/caption-field';
import { duration } from '@/ui/format';
import { Field } from '@/ui/kit/field';
import { Segment } from '@/ui/kit/segment';
import { Slider } from '@/ui/kit/slider';

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
        <CaptionField
          value={eventDescription}
          onChangeText={onEventDescription}
          onEndEditing={onEventDescriptionDone}
          placeholder={t('project.descriptionPlaceholder')}
          maxLength={2000}
        />
        <CaptionField
          value={draft.prompt}
          onChangeText={(prompt) => onChange({ prompt })}
          placeholder={t('montage.order.promptPlaceholder')}
          maxLength={4000}
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
