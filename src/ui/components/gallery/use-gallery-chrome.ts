import { useCallback, useEffect, useState } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';

const SCROLL_THRESHOLD = 16;

export function useGalleryChrome({
  selectionDefault = false,
  canSelect = true,
}: {
  selectionDefault?: boolean;
  canSelect?: boolean;
}) {
  const chrome = useSharedValue(0);
  const filterAnim = useSharedValue(0);
  const [scrolled, setScrolled] = useState(false);
  const [selecting, setSelecting] = useState(selectionDefault);
  const [filtering, setFiltering] = useState(false);

  // Скрытие в просмотрщике не должно сбрасывать состояние: худ возвращается уже тем,
  // каким он должен быть сейчас, без мелькания основной кнопки.
  const actionsOpen = scrolled || filtering;

  useEffect(() => {
    chrome.value = withTiming(actionsOpen ? 1 : 0, { duration: 200 });
  }, [actionsOpen, chrome]);

  useEffect(() => {
    filterAnim.value = withTiming(filtering ? 1 : 0, { duration: 240 });
  }, [filterAnim, filtering]);

  const onScroll = useCallback((offset: number) => {
    setScrolled(offset > SCROLL_THRESHOLD);
  }, []);

  const toggleSelecting = useCallback(() => {
    if (!canSelect) return;
    setSelecting((was) => !was);
  }, [canSelect]);

  const closeFilter = useCallback(() => setFiltering(false), []);

  return {
    chrome,
    filterAnim,
    scrolled,
    selecting,
    setSelecting,
    toggleSelecting,
    filtering,
    setFiltering,
    closeFilter,
    onScroll,
    actionsOpen,
  };
}
