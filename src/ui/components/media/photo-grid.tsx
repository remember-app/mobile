import { FlashList, type FlashListRef } from '@shopify/flash-list';
import type { ImageSource } from 'expo-image';
import { type ComponentRef, type MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { radius } from '@/ui/theme';

import { PhotoTile, type TileUpload } from './photo-tile';

export const PHOTO_COLUMNS = 3;

export type Photo = {
  id: string;
  source: ImageSource | string | null;
  video?: boolean;
  assetId?: string;
  playbackUrl?: string | null;
  width?: number;
  height?: number;
  upload?: TileUpload;
  select?: number | null;
  accent?: boolean;
  note?: string;
  author?: string | null;
  labelColors?: string[];
  capturedAt?: Date | null;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MeasureTile = (index: number, done: (rect: Rect) => void) => void;

type Props = {
  photos: readonly Photo[];
  onOpen: (index: number, rect?: Rect) => void;
  onSelect?: (index: number) => void;
  padding?: { top: number; bottom: number };
  blankIndex?: number | null;
  measureRef?: MutableRefObject<MeasureTile | null>;
  onLoadOlder?: () => void;
  onScroll?: (offset: number) => void;
  mark?: 'number' | 'check';
  emptyMark?: boolean;
  tapSelects?: boolean;
};

type ListItem = { key: string; index: number; photo: Photo };

const GAP = 2;

export function PhotoGrid({
  photos,
  onOpen,
  onSelect,
  padding,
  blankIndex,
  measureRef,
  onLoadOlder,
  onScroll,
  mark,
  emptyMark,
  tapSelects,
}: Props) {
  const topPad = padding?.top ?? 0;
  const bottomPad = padding?.bottom ?? 0;
  const { width } = useWindowDimensions();
  const pitch = width / PHOTO_COLUMNS;
  const list = useRef<FlashListRef<ListItem>>(null);
  const cells = useRef(new Map<string, ComponentRef<typeof View> | null>());
  const userMoved = useRef(false);

  const layout = useMemo(() => {
    const items: ListItem[] = [];
    const at = new Map<number, number>();
    for (let start = 0; start < photos.length; start += PHOTO_COLUMNS) {
      const row: ListItem[] = [];
      for (let index = start; index < Math.min(start + PHOTO_COLUMNS, photos.length); index += 1) {
        const photo = photos[index];
        if (photo) row.push({ key: photo.id, index, photo });
      }
      row.reverse();
      for (const item of row) {
        at.set(item.index, items.length);
        items.push(item);
      }
    }
    return { data: items, at };
  }, [photos]);
  useEffect(() => {
    if (!measureRef) return;
    measureRef.current = (index, done) => {
      const photo = photos[index];
      const node = photo ? cells.current.get(photo.id) : null;
      const take = (target: ComponentRef<typeof View>) =>
        target.measureInWindow((x, y, w, h) => done({ x, y, width: w - GAP, height: h - GAP }));
      if (node) {
        take(node);
        return;
      }
      const target = layout.at.get(index);
      if (target === undefined) return;
      void list.current?.scrollToIndex({ index: target, animated: false }).then(() => {
        requestAnimationFrame(() => {
          const next = photo ? cells.current.get(photo.id) : null;
          if (next) take(next);
        });
      });
    };
    return () => {
      measureRef.current = null;
    };
  }, [layout, measureRef, photos]);

  return (
    <View style={styles.root}>
      <FlashList
        ref={list}
        data={layout.data}
        extraData={blankIndex}
        numColumns={PHOTO_COLUMNS}
        keyExtractor={(item) => item.key}
        inverted
        maintainVisibleContentPosition={{ disabled: true }}
        onEndReached={() => {
          if (userMoved.current) onLoadOlder?.();
        }}
        onEndReachedThreshold={1}
        onScroll={(event) => onScroll?.(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          userMoved.current = true;
        }}
        onMomentumScrollBegin={() => {
          userMoved.current = true;
        }}
        contentContainerStyle={{ paddingTop: bottomPad, paddingBottom: topPad }}
        style={styles.list}
        renderItem={({ item }) => {
          const { photo, index } = item;
          return (
            <View
              ref={(node) => {
                if (node) cells.current.set(photo.id, node);
                else cells.current.delete(photo.id);
              }}
              style={{ height: pitch, paddingRight: GAP, paddingBottom: GAP }}
            >
              {index === blankIndex ? (
                <View style={styles.blank} />
              ) : (
                <PhotoTile
                  id={photo.id}
                  source={photo.source}
                  upload={photo.upload}
                  select={photo.select}
                  mark={mark}
                  emptyMark={emptyMark}
                  accent={photo.accent}
                  note={photo.note}
                  author={photo.author}
                  labelColors={photo.labelColors}
                  onSelect={() => onSelect?.(index)}
                  onPress={() => {
                    if (tapSelects && photo.select !== undefined) {
                      onSelect?.(index);
                      return;
                    }
                    const node = cells.current.get(photo.id);
                    if (!node) {
                      onOpen(index);
                      return;
                    }
                    node.measureInWindow((x, y, w, h) =>
                      onOpen(index, { x, y, width: w - GAP, height: h - GAP }),
                    );
                  }}
                />
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
  },
  blank: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: radius.tile,
  },
});
