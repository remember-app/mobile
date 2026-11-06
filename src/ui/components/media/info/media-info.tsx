import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/ui/theme';

import { CaptionField } from './caption-field';
import { MetaCard, type PhotoMeta } from './meta-card';
import { PlaceMap } from './place-map';

export function MediaInfo({ meta, onEdit }: { meta: PhotoMeta; onEdit?: () => void }) {
  const [caption, setCaption] = useState('');

  return (
    <View style={styles.body}>
      <CaptionField value={caption} onChangeText={setCaption} />
      <MetaCard meta={meta} onEdit={onEdit} />
      <PlaceMap place={meta.place} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space.s4,
  },
});
