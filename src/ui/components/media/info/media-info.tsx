import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { attachItems, detachItems, loadLabels, updateItem } from '@/functionality';
import type { Item } from '@/models';
import type { LabelId, ProjectId } from '@/types/id';
import { useLabels } from '@/ui/hooks';
import { space } from '@/ui/theme';

import { CaptionField } from './caption-field';
import { LabelsBlock } from './labels-block';
import { MetaCard, type PhotoMeta } from './meta-card';
import { PlaceMap } from './place-map';

export function MediaInfo({ projectId, item }: { projectId: ProjectId; item: Item }) {
  const labels = useLabels(projectId);
  const [caption, setCaption] = useState(item.description ?? '');

  useEffect(() => {
    setCaption(item.description ?? '');
  }, [item.id, item.description]);

  useEffect(() => {
    void loadLabels(projectId);
  }, [projectId]);

  const media = item.media;
  const meta: PhotoMeta = {
    capturedAt: media.capturedAt ?? item.createdAt,
    cameraModel: media.camera?.model ?? '',
    format: media.format,
    lens: '',
    standard: false,
    width: media.dimensions?.width ?? 0,
    height: media.dimensions?.height ?? 0,
    bytes: media.bytes,
    iso: media.camera?.exposure.iso ?? null,
    focalLengthMm: media.camera?.focalLengthMm ?? null,
    ev: media.camera?.exposure.ev ?? null,
    aperture: media.camera?.exposure.aperture ?? null,
    shutter: media.camera?.exposure.shutter ?? null,
    place: null,
  };

  const all = labels.labels.map((label) => ({
    id: label.id,
    name: label.name,
    color: label.color,
  }));
  const assigned = all.filter((label) => item.labelIds.includes(label.id as LabelId));

  const toggle = (labelId: string) => {
    if (assigned.some((label) => label.id === labelId)) {
      void detachItems(projectId, labelId as LabelId, [item.id]);
    } else {
      void attachItems(projectId, labelId as LabelId, [item.id]);
    }
  };

  return (
    <View style={styles.body}>
      <CaptionField
        value={caption}
        onChangeText={setCaption}
        onEndEditing={() => void updateItem(projectId, item.id, caption.trim() || null)}
      />
      <MetaCard meta={meta} />
      <LabelsBlock labels={assigned} all={all} onToggle={toggle} />
      <PlaceMap place={meta.place} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space.s4,
  },
});
