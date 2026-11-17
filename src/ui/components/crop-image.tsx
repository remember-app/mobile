import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Image as NativeImage, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/ui/kit/button';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { radius, space, themed } from '@/ui/theme';

type Size = { width: number; height: number };

export function CropImageModal({
  uri,
  onCancel,
  onDone,
}: {
  uri: string | null;
  onCancel: () => void;
  onDone: (uri: string) => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [size, setSize] = useState<Size | null>(null);
  const [busy, setBusy] = useState(false);
  const side = Math.min(width - space.s5 * 2, height * 0.6);
  const scale = size === null ? 1 : Math.max(side / size.width, side / size.height);
  const shown =
    size === null
      ? { width: side, height: side }
      : {
          width: size.width * scale,
          height: size.height * scale,
        };
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;

  useEffect(() => {
    if (uri === null) {
      setSize(null);
      return;
    }
    let live = true;
    NativeImage.getSize(
      uri,
      (imageWidth, imageHeight) => {
        if (!live) return;
        setSize({ width: imageWidth, height: imageHeight });
        const fit = Math.max(side / imageWidth, side / imageHeight);
        tx.value = (side - imageWidth * fit) / 2;
        ty.value = (side - imageHeight * fit) / 2;
      },
      () => {
        if (live) cancel.current();
      },
    );
    return () => {
      live = false;
    };
  }, [uri, side, tx, ty]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      fromX.value = tx.value;
      fromY.value = ty.value;
    })
    .onUpdate((event) => {
      const minX = side - shown.width;
      const minY = side - shown.height;
      tx.value = Math.min(0, Math.max(minX, fromX.value + event.translationX));
      ty.value = Math.min(0, Math.max(minY, fromY.value + event.translationY));
    });

  const body = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  const confirm = async () => {
    if (uri === null || size === null) return;
    setBusy(true);
    try {
      const originX = Math.max(0, Math.round(-tx.value / scale));
      const originY = Math.max(0, Math.round(-ty.value / scale));
      const length = Math.round(side / scale);
      const context = ImageManipulator.manipulate(uri).crop({
        originX,
        originY,
        width: Math.min(length, size.width - originX),
        height: Math.min(length, size.height - originY),
      });
      const image = await context.renderAsync();
      const result = await image.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
      onDone(result.uri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={uri !== null}
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.stage}>
          <View style={[styles.frame, { width: side, height: side }]}>
            {size === null ? (
              <CircularSpinner size={28} />
            ) : (
              <GestureDetector gesture={pan}>
                <Animated.View style={[styles.canvas, shown, body]}>
                  <NativeImage source={{ uri: uri ?? undefined }} style={styles.image} />
                </Animated.View>
              </GestureDetector>
            )}
          </View>
        </View>
        <View style={styles.actions}>
          <Button label={t('action.cancel')} variant="secondary" onPress={onCancel} />
          <Button
            label={t('action.done')}
            variant="primary"
            disabled={size === null || busy}
            onPress={() => void confirm()}
          />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: color.ink,
      justifyContent: 'space-between',
    },
    stage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    frame: {
      overflow: 'hidden',
      borderRadius: radius.cell,
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
    canvas: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    actions: {
      flexDirection: 'row',
      gap: space.s3,
      paddingHorizontal: space.s5,
      paddingTop: space.s4,
    },
  }),
);
