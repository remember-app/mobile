import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { labelsState, subscribeLabels, toggleLabel } from '@/ui/mocks/labels';
import { space } from '@/ui/theme';

import { CaptionField } from './caption-field';
import { LabelsBlock } from './labels-block';
import { MetaCard, type PhotoMeta } from './meta-card';
import { PlaceMap } from './place-map';

export function MediaInfo({
  photoId,
  meta,
  onEdit,
}: {
  photoId: string;
  meta: PhotoMeta;
  onEdit?: () => void;
}) {
  const [caption, setCaption] = useState('');
  const labels = useSyncExternalStore(subscribeLabels, () => labelsState(photoId));

  return (
    <View style={styles.body}>
      <CaptionField value={caption} onChangeText={setCaption} />
      <MetaCard meta={meta} onEdit={onEdit} />
      <LabelsBlock
        labels={labels.assigned}
        all={labels.all}
        onToggle={(labelId) => toggleLabel(photoId, labelId)}
      />
      <PlaceMap place={meta.place} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space.s4,
  },
});
