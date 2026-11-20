import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { attachItems, detachItems, loadLabels, updateItem } from '@/functionality';
import { type Item, itemDate } from '@/models';
import type { LabelId, ProjectId } from '@/types/id';
import { useLabels } from '@/ui/hooks';
import { space } from '@/ui/theme';
import { AnalysisBlock } from './analysis-block';
import { CaptionField } from './caption-field';
import { LabelsBlock } from './labels-block';
import { MetaCard, type PhotoMeta } from './meta-card';
import { PlaceMap } from './place-map';

/** Сведения о файле для просмотрщика: по идентификатору кадра, а не по индексу —
 *  ленты экранов сортируют и дополняют кадры по-своему. */
export function useMediaInfo(projectId: ProjectId, items: readonly Item[]) {
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item] as const)), [items]);
  return useCallback(
    (id: string) => {
      const item = byId.get(id);
      return item ? <MediaInfo key={id} projectId={projectId} item={item} /> : null;
    },
    [byId, projectId],
  );
}

export function MediaInfo({ projectId, item }: { projectId: ProjectId; item: Item }) {
  const labels = useLabels(projectId);
  const [caption, setCaption] = useState(item.comment ?? '');

  useEffect(() => {
    setCaption(item.comment ?? '');
  }, [item.id, item.comment]);

  useEffect(() => {
    void loadLabels(projectId);
  }, [projectId]);

  const media = item.media;
  const meta: PhotoMeta = {
    capturedAt: itemDate(item),
    cameraModel: media.meta.camera?.model ?? '',
    format: media.format,
    lens: '',
    standard: false,
    width: media.meta.dimensions?.width ?? 0,
    height: media.meta.dimensions?.height ?? 0,
    bytes: media.bytes,
    iso: media.meta.camera?.exposure.iso ?? null,
    focalLengthMm: media.meta.camera?.focalLengthMm ?? null,
    ev: media.meta.camera?.exposure.ev ?? null,
    aperture: media.meta.camera?.exposure.aperture ?? null,
    shutter: media.meta.camera?.exposure.shutter ?? null,
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
      <LabelsBlock labels={assigned} all={all} onToggle={toggle} />
      <AnalysisBlock projectId={projectId} item={item} />
      <MetaCard meta={meta} />
      <PlaceMap place={meta.place} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space.s4,
  },
});
