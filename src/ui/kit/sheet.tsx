import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export const SCRIM_DEAF_MS = 300;

export function useShutOnBlur(visible: boolean, onCancel: () => void): void {
  const now = useRef({ visible, onCancel });
  now.current = { visible, onCancel };
  useFocusEffect(
    useCallback(
      () => () => {
        if (now.current.visible) now.current.onCancel();
      },
      [],
    ),
  );
}

export function useScrimTap(onCancel: () => void): () => void {
  const openedAt = useRef(Date.now());
  return () => {
    if (Date.now() - openedAt.current >= SCRIM_DEAF_MS) onCancel();
  };
}

export function useMeasured(): [number, (event: LayoutChangeEvent) => void] {
  const [height, setHeight] = useState(0);
  return [height, (event) => setHeight(event.nativeEvent.layout.height)];
}
