import { setStatusBarHidden } from 'expo-status-bar';
import { Check, Download, Ellipsis, ImageDown, Trash2 } from 'lucide-react-native';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { type ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { cachedVariant, itemById, keepVariant, saveItemToPhone } from '@/functionality';
import { confirmAction } from '@/ui/confirm';
import { fullDay, time } from '@/ui/format';
import { BlurBar } from '@/ui/kit/chrome/blur-bar';
import { BackButton, IconButton } from '@/ui/kit/controls/button';
import { Avatar } from '@/ui/kit/primitives/avatar';
import { Image } from '@/ui/kit/primitives/image';
import { Text } from '@/ui/kit/primitives/text';
import { photo, radius, space, useTheme } from '@/ui/theme';
import { PhotoInfo } from './info/photo-info';
import type { Rect } from './photo-grid';
import { PhotoStrip, STRIP_PITCH } from './photo-strip';
import { boxFor, mediaSize, targetFor } from './viewer/geometry';
import { viewerLayout } from './viewer/layout';
import type { ViewerPhoto } from './viewer/types';
import { VideoFrame } from './viewer/video-frame';
import { Zoomable } from './viewer/zoomable';

export type { ViewerPhoto } from './viewer/types';

type Props = {
  photos: readonly ViewerPhoto[];
  initialIndex: number;
  origin?: Rect;
  onClose: () => void;
  onCloseStart?: () => void;
  /** Проявление экрана под кадром; по умолчанию кадр живёт без него. */
  reveal?: SharedValue<number>;
  onIndex?: (index: number) => void;
  onLoadMore?: () => void;
  renderInfo?: (index: number) => ReactNode;
  author?: string;
  authorAvatarUrl?: string | null;
  onDelete?: (photo: ViewerPhoto) => void;
  selected?: boolean;
  onSelect?: () => void;
};

type Phase = 'entering' | 'open' | 'leaving';

const HUD_GAP = 60;

export function PhotoViewer({
  photos,
  initialIndex,
  origin,
  onClose,
  onCloseStart,
  reveal: outerReveal,
  onIndex,
  onLoadMore,
  renderInfo,
  author,
  authorAvatarUrl,
  onDelete,
  selected,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const background = theme.name === 'dark' ? photo.viewer : theme.color.surface;
  const panel = theme.name === 'dark' ? photo.viewer : theme.color.ink;
  const viewPhotos = useMemo(() => [...photos].reverse(), [photos]);
  const start = Math.max(0, viewPhotos.length - 1 - initialIndex);
  const indexRef = useRef(start);
  const [index, setIndex] = useState(start);
  const shownId = useRef<string | null>(viewPhotos[start]?.id ?? null);
  const shownCount = useRef(viewPhotos.length);
  const [hdIndex, setHdIndex] = useState(-1);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [originals, setOriginals] = useState<Record<string, string>>({});
  const [originalProgress, setOriginalProgress] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [info, setInfo] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const dragY = useSharedValue(0);
  const lift = useSharedValue(0);
  const { width, height } = useWindowDimensions();
  const mainRef = useAnimatedRef<ScrollViewInstance>();
  const stripRef = useAnimatedRef<ScrollViewInstance>();
  const mainX = useSharedValue(start * width);
  const stripX = useSharedValue(start * STRIP_PITCH);
  const stripActive = useSharedValue(0);
  const initialMain = useMemo(() => ({ x: index * width, y: 0 }), [index, width]);
  const cover = viewPhotos[start]?.source ?? null;
  const currentPhoto = viewPhotos[index];
  const current = currentPhoto?.source ?? null;
  const startBox = boxFor(currentPhoto ? mediaSize(currentPhoto) : null, width, height);
  const layout = viewerLayout(width, height, insets);
  const startTop = (height - startBox.height) / 2;
  const grows = Boolean(origin && cover);
  const canInfo = Boolean(renderInfo);
  const [phase, setPhase] = useState<Phase>(grows ? 'entering' : 'open');
  const [chrome, setChrome] = useState(true);
  const [muted, setMuted] = useState(false);
  const [speedMode, setSpeedMode] = useState(false);
  const ownReveal = useSharedValue(1);
  const reveal = outerReveal ?? ownReveal;
  const progress = useSharedValue(grows ? 0 : 1);
  // Верх просмотрщика живёт вместе с лентой: появляется на последней трети раскрытия,
  // гаснет сразу по началу закрытия — а не по мере движения пальца.
  const barFade = useSharedValue(1);
  const flight = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromSX = useSharedValue(1);
  const fromSY = useSharedValue(1);
  const menuAnim = useSharedValue(0);
  const selectAnim = useSharedValue(selected === undefined ? 0 : 1);
  const originalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setStatusBarHidden(!chrome || info || zoomed, 'fade');
  }, [chrome, info, zoomed]);

  useEffect(() => {
    menuAnim.value = withTiming(menuOpen ? 1 : 0, { duration: 180 });
  }, [menuAnim, menuOpen]);

  useEffect(() => {
    selectAnim.value = withTiming(selected === undefined ? 0 : 1, { duration: 180 });
  }, [selectAnim, selected]);

  useEffect(() => {
    setMenuOpen(false);
    setOriginalProgress(null);
    if (originalTimer.current) clearTimeout(originalTimer.current);
    return () => {
      if (originalTimer.current) clearTimeout(originalTimer.current);
    };
  }, [currentPhoto?.id]);

  useEffect(() => {
    setSpeedMode(false);
  }, [currentPhoto?.id]);

  useEffect(() => {
    reveal.value = withTiming(0, { duration: 220 });
    return () => {
      reveal.value = 1;
    };
  }, [reveal]);

  const endScroll = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearEndScroll = useCallback(() => {
    if (endScroll.current) {
      clearTimeout(endScroll.current);
      endScroll.current = null;
    }
  }, []);
  useEffect(() => () => clearEndScroll(), [clearEndScroll]);

  const jumpTo = useCallback(
    (at: number) => {
      mainX.value = at * width;
      stripX.value = at * STRIP_PITCH;
      mainRef.current?.scrollTo({ x: at * width, y: 0, animated: false });
      stripRef.current?.scrollTo({ x: at * STRIP_PITCH, y: 0, animated: false });
    },
    [mainX, stripX, width],
  );

  const size = useRef({ width, height });
  const realign = useRef(false);
  useLayoutEffect(() => {
    if (size.current.width === width && size.current.height === height) return;
    size.current = { width, height };
    realign.current = true;
    jumpTo(indexRef.current);
  }, [height, jumpTo, width]);

  // Older pages are prepended to the strip, so every index shifts. Follow the photo that is
  // on screen instead of the number, or the viewer would silently jump to another one.
  useLayoutEffect(() => {
    if (viewPhotos.length === shownCount.current) return;
    shownCount.current = viewPhotos.length;
    const id = shownId.current;
    if (id === null) return;
    const at = viewPhotos.findIndex((photo) => photo.id === id);
    if (at < 0 || at === indexRef.current) return;
    indexRef.current = at;
    setIndex(at);
    jumpTo(at);
  }, [jumpTo, viewPhotos]);

  useEffect(() => {
    if (info) return;
    setChrome(true);
  }, [currentPhoto?.id, info]);

  const loadMore = useRef(onLoadMore);
  useEffect(() => {
    loadMore.current = onLoadMore;
  });
  useEffect(() => {
    if (index <= 2) loadMore.current?.();
  }, [index]);

  useEffect(() => {
    const photo = viewPhotos[index];
    const timer = setTimeout(() => {
      setHdIndex(index);
      if (!photo || photo.video || !photo.projectId || originals[photo.id]) return;
      const item = itemById(photo.projectId, photo.id);
      if (!item) return;
      const cached = cachedVariant(item, 'detail');
      if (cached) {
        if (!originals[photo.id]) setDetails((was) => ({ ...was, [photo.id]: cached }));
        return;
      }
      void keepVariant(item, 'detail').then((local) => {
        if (local && !originals[photo.id]) setDetails((was) => ({ ...was, [photo.id]: local }));
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [index, originals, viewPhotos]);

  useEffect(() => () => setStatusBarHidden(false, 'fade'), []);

  useEffect(() => {
    if (!grows) return;
    const frame = requestAnimationFrame(() => {
      progress.value = withTiming(
        1,
        { duration: 300, easing: Easing.out(Easing.cubic) },
        (done) => {
          if (done) scheduleOnRN(setPhase, 'open');
        },
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [grows, progress]);

  const targetLeft = origin?.x ?? 0;
  const targetTop = origin?.y ?? 0;
  const enter = targetFor(viewPhotos[start], width, height);
  const exit = targetFor(viewPhotos[index], width, height);

  const update = useCallback(
    (next: number) => {
      if (next === indexRef.current) return;
      indexRef.current = next;
      shownId.current = viewPhotos[next]?.id ?? null;
      dragY.value = 0;
      setIndex(next);
    },
    [dragY, viewPhotos],
  );

  const lastSettled = useRef(start);
  const settle = useCallback(
    (next: number) => {
      update(next);
      if (lastSettled.current === next) return;
      lastSettled.current = next;
      onIndex?.(viewPhotos.length - 1 - next);
    },
    [onIndex, update, viewPhotos.length],
  );

  const scrub = useCallback(
    (next: number) => {
      const before = indexRef.current;
      settle(next);
      if (next !== before) mainRef.current?.scrollTo({ x: next * width, y: 0, animated: false });
    },
    [settle, width],
  );

  const mainScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      mainX.value = event.contentOffset.x;
      if (stripActive.value === 0) {
        stripX.value = (event.contentOffset.x / width) * STRIP_PITCH;
        scrollTo(stripRef, stripX.value, 0, false);
      }
    },
  });

  const leave = useCallback(() => {
    barFade.value = withTiming(0, { duration: 150 });
    reveal.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    onCloseStart?.();
    if (!origin || phase === 'leaving') {
      onClose();
      return;
    }
    const dy = dragY.value;
    fromY.value = dy;
    const shrink = 1 - Math.min(Math.abs(dy) / 2000, 0.15);
    fromSX.value = shrink;
    fromSY.value = shrink;
    flight.value = 0;
    setPhase('leaving');
    flight.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) scheduleOnRN(onClose);
    });
  }, [barFade, dragY, flight, fromSX, fromSY, fromY, onClose, onCloseStart, origin, phase, reveal]);

  const backdrop = useAnimatedStyle(() => {
    const drag = 1 - Math.min(Math.abs(dragY.value) / 300, 1);
    return { opacity: Math.min(progress.value, drag) * (1 - flight.value) };
  });
  const coverScale = Math.max(1, (height * 0.4) / Math.max(startBox.height, 1));
  const coverY = -height * 0.3;
  const pagerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: coverY * lift.value }, { scale: 1 + (coverScale - 1) * lift.value }],
  }));
  const photoBottom = startTop + startBox.height;
  const infoStyle = useAnimatedStyle(() => ({
    top: photoBottom + (height * 0.4 - photoBottom) * lift.value,
    opacity: Math.min(1, lift.value * 12),
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: lift.value,
  }));
  const authorStyle = useAnimatedStyle(() => ({
    top: photoBottom + (height * 0.4 - photoBottom) * lift.value - 44,
    opacity: lift.value,
  }));
  const barStyle = useAnimatedStyle(() => {
    const appear = Math.max(0, Math.min(1, (progress.value - 0.6) / 0.4));
    return { opacity: appear * barFade.value };
  });
  const menuStyle = useAnimatedStyle(() => ({
    opacity: menuAnim.value,
    transform: [{ translateY: (1 - menuAnim.value) * -20 }],
  }));
  const selectStyle = useAnimatedStyle(() => ({
    opacity: selectAnim.value,
    transform: [{ translateX: (1 - selectAnim.value) * 20 }],
  }));
  const stripStyle = useAnimatedStyle(() => {
    const appear = Math.max(0, Math.min(1, (progress.value - 0.6) / 0.4));
    const gone = Math.min(1, Math.max(0, (lift.value - 0.2) / 0.2));
    return { opacity: appear * barFade.value * (1 - gone) };
  });
  const growth = useAnimatedStyle(() => {
    const t = progress.value;
    const sx = origin ? origin.width / enter.width : 1;
    const sy = origin ? origin.height / enter.height : 1;
    const tx = origin ? origin.x - enter.left : 0;
    const ty = origin ? origin.y - enter.top : 0;
    return {
      transformOrigin: 'top left',
      transform: [
        { translateX: tx * (1 - t) },
        { translateY: ty * (1 - t) },
        { scaleX: sx + (1 - sx) * t },
        { scaleY: sy + (1 - sy) * t },
      ],
    };
  });
  const landing = useAnimatedStyle(() => {
    const sx = fromSX.value;
    const sy = fromSY.value;
    const startX = (exit.width * (1 - sx)) / 2;
    const startY = (exit.height * (1 - sy)) / 2 + fromY.value;
    const endX = targetLeft - exit.left;
    const endY = targetTop - exit.top;
    const endSX = origin ? origin.width / exit.width : 1;
    const endSY = origin ? origin.height / exit.height : 1;
    const fly = flight.value;
    return {
      opacity: fly <= 0.9 ? 1 - fly / 0.9 : 0,
      transformOrigin: 'top left',
      transform: [
        { translateX: startX + (endX - startX) * fly },
        { translateY: startY + (endY - startY) * fly },
        { scaleX: sx + (endSX - sx) * fly },
        { scaleY: sy + (endSY - sy) * fly },
      ],
    };
  });

  const tileCover = origin ? Math.max(width / origin.width, height / origin.height) : 1;
  const squareStartLeft = origin ? (width - origin.width * tileCover) / 2 : 0;
  const squareStartTop = origin ? (height - origin.height * tileCover) / 2 : 0;
  const square = useAnimatedStyle(() => {
    const fly = flight.value;
    const scale = tileCover + (1 - tileCover) * fly;
    const left = squareStartLeft + (targetLeft - squareStartLeft) * fly;
    const top = (squareStartTop + fromY.value) * (1 - fly) + targetTop * fly;
    return {
      opacity: Math.min(1, fly / 0.9),
      transformOrigin: 'top left',
      transform: [{ translateX: left }, { translateY: top }, { scale }],
    };
  });

  const activeItem = currentPhoto?.projectId
    ? itemById(currentPhoto.projectId, currentPhoto.id)
    : undefined;
  const menuAvailable = Boolean(currentPhoto && (onDelete || activeItem));
  const cachedOriginal = activeItem ? cachedVariant(activeItem, 'original') : null;
  const originalLoaded = Boolean(currentPhoto && (originals[currentPhoto.id] ?? cachedOriginal));

  const deleteCurrent = () => {
    const photo = currentPhoto;
    if (!photo || !onDelete) return;
    setMenuOpen(false);
    confirmAction({
      confirm: t('action.delete'),
      destructive: true,
      onConfirm: () => onDelete(photo),
    });
  };

  const saveCurrent = () => {
    if (!activeItem) return;
    setMenuOpen(false);
    void saveItemToPhone(activeItem);
  };

  const toggleOriginal = () => {
    const photo = currentPhoto;
    if (!photo || !activeItem) return;
    setMenuOpen(false);
    if (originalLoaded) {
      const local = originals[photo.id] ?? cachedOriginal;
      if (!local) return;
      if (originalTimer.current) clearTimeout(originalTimer.current);
      originalTimer.current = setTimeout(() => {
        setDetails((was) => ({ ...was, [photo.id]: local }));
        setHdIndex(index);
      }, 600);
      return;
    }
    setOriginalProgress(0);
    void keepVariant(activeItem, 'original', 0, ({ bytesWritten, totalBytes }) => {
      setOriginalProgress(totalBytes > 0 ? Math.min(1, bytesWritten / totalBytes) : 0.1);
    }).then((local) => {
      setOriginalProgress(null);
      if (!local) return;
      setOriginals((was) => ({ ...was, [photo.id]: local }));
      if (originalTimer.current) clearTimeout(originalTimer.current);
      originalTimer.current = setTimeout(() => {
        setDetails((was) => ({ ...was, [photo.id]: local }));
        setHdIndex(index);
      }, 600);
    });
  };

  const busy = phase !== 'open';

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: background }, backdrop]} />
      <Animated.View
        style={[StyleSheet.absoluteFill, busy ? styles.off : null, pagerStyle]}
        pointerEvents={busy ? 'none' : 'auto'}
      >
        <Animated.ScrollView
          ref={mainRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={mainScroll}
          scrollEventThrottle={16}
          scrollEnabled={!zoomed}
          contentOffset={initialMain}
          onContentSizeChange={() => {
            if (!realign.current) return;
            realign.current = false;
            const at = indexRef.current;
            mainX.value = at * width;
            mainRef.current?.scrollTo({ x: at * width, y: 0, animated: false });
          }}
          onScrollBeginDrag={() => {
            clearEndScroll();
            setScrolling(true);
          }}
          onScrollEndDrag={() => {
            clearEndScroll();
            endScroll.current = setTimeout(() => setScrolling(false), 220);
          }}
          onMomentumScrollBegin={clearEndScroll}
          onMomentumScrollEnd={() => {
            clearEndScroll();
            setScrolling(false);
            settle(Math.round(mainX.value / width));
          }}
          style={StyleSheet.absoluteFill}
        >
          {viewPhotos.map((photo, at) => (
            <View key={photo.id} style={{ width, height }}>
              {Math.abs(at - index) <= 2 ? (
                photo.video ? (
                  <VideoFrame
                    photo={photo}
                    width={width}
                    height={height}
                    layout={layout}
                    dragY={dragY}
                    lift={lift}
                    hudFade={barFade}
                    hudStyle={barStyle}
                    info={info}
                    canInfo={canInfo}
                    onInfo={setInfo}
                    onDismiss={leave}
                    reveal={reveal}
                    onTap={() => setChrome((shown) => !shown)}
                    onZoomed={setZoomed}
                    active={at === index}
                    visible={chrome && !zoomed && at === index && !scrolling}
                    muted={muted}
                    onMutedChange={setMuted}
                    speed={speedMode ? 2 : 1}
                    onSpeedChange={setSpeedMode}
                  />
                ) : (
                  <Zoomable
                    source={photo.source}
                    hd={at === hdIndex ? (photo.original ?? details[photo.id] ?? null) : null}
                    group={photo.projectId}
                    media={mediaSize(photo)}
                    width={width}
                    height={height}
                    dragY={dragY}
                    lift={lift}
                    hudFade={barFade}
                    info={info}
                    canInfo={canInfo}
                    onInfo={setInfo}
                    onZoomed={setZoomed}
                    onDismiss={leave}
                    reveal={reveal}
                    onTap={() => setChrome((shown) => !shown)}
                  />
                )
              ) : null}
            </View>
          ))}
        </Animated.ScrollView>
      </Animated.View>
      <Animated.View
        style={[styles.info, { backgroundColor: panel }, infoStyle]}
        pointerEvents={info ? 'auto' : 'none'}
      >
        <Animated.View style={[styles.fill, contentStyle]}>
          <PhotoInfo lift={lift} onDismiss={() => setInfo(false)}>
            {renderInfo?.(viewPhotos.length - 1 - index)}
          </PhotoInfo>
        </Animated.View>
      </Animated.View>
      {author && !currentPhoto?.video && !zoomed ? (
        <Animated.View style={[styles.author, authorStyle]} pointerEvents="none">
          <Avatar name={author} size={34} uri={authorAvatarUrl} />
        </Animated.View>
      ) : null}
      {phase === 'entering' && cover ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flight,
            { left: enter.left, top: enter.top, width: enter.width, height: enter.height },
            growth,
          ]}
        >
          <Image
            source={cover}
            group={viewPhotos[start]?.projectId}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
          />
        </Animated.View>
      ) : null}
      {phase === 'leaving' && current ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flight,
            { left: exit.left, top: exit.top, width: exit.width, height: exit.height },
            landing,
          ]}
        >
          <Image
            source={current}
            group={currentPhoto?.projectId}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
          />
        </Animated.View>
      ) : null}
      {phase === 'leaving' && current && origin ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.square, { width: origin.width, height: origin.height }, square]}
        >
          <Image
            source={current}
            group={currentPhoto?.projectId}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        </Animated.View>
      ) : null}
      {chrome && !zoomed && viewPhotos.length > 1 ? (
        <Animated.View
          pointerEvents={info || phase !== 'open' ? 'none' : 'auto'}
          style={[
            styles.strip,
            {
              bottom: layout.stripHitBottom,
            },
            stripStyle,
          ]}
        >
          <PhotoStrip
            photos={viewPhotos}
            index={start}
            layout={layout}
            scroller={stripRef}
            active={stripActive}
            scrollX={stripX}
            onScrolling={setScrolling}
            onSettle={scrub}
          />
        </Animated.View>
      ) : null}
      {speedMode && currentPhoto?.video ? (
        <BlurBar
          edge="top"
          shade={false}
          style={[
            styles.hud,
            styles.speedBar,
            { top: layout.hudTop + 56, paddingHorizontal: layout.hudSide },
          ]}
        >
          <View
            style={[
              styles.hudBox,
              { backgroundColor: theme.color.surface, borderColor: theme.color.line },
            ]}
          >
            <Text role="row">2×</Text>
          </View>
        </BlurBar>
      ) : null}
      {chrome && !zoomed && !info ? (
        <Animated.View
          pointerEvents={phase === 'open' ? 'box-none' : 'none'}
          style={[StyleSheet.absoluteFill, barStyle]}
        >
          <BlurBar
            edge="top"
            shade={false}
            style={[styles.hud, { top: layout.hudTop, paddingHorizontal: layout.hudSide }]}
          >
            <BackButton label={t('action.back')} size={44} onPress={leave} />
            <View
              style={[styles.hudWords, { maxWidth: width - layout.hudSide * 2 - 88 - HUD_GAP * 2 }]}
            >
              {currentPhoto?.capturedAt ? (
                <View
                  style={[
                    styles.hudBox,
                    {
                      backgroundColor: theme.color.surface,
                      borderColor: theme.color.line,
                    },
                  ]}
                >
                  <Text role="row" numberOfLines={1}>
                    {fullDay(currentPhoto.capturedAt)}
                  </Text>
                  <Text role="meta" numberOfLines={1}>
                    {time(currentPhoto.capturedAt)}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.hudRight}>
              {selected !== undefined && onSelect ? (
                <Animated.View style={selectStyle}>
                  <IconButton
                    icon={Check}
                    label={t('project.select')}
                    tone="surface"
                    size={44}
                    on={selected}
                    onPress={onSelect}
                  />
                </Animated.View>
              ) : null}
              {menuAvailable ? (
                <IconButton
                  icon={Ellipsis}
                  label={t('action.more')}
                  tone="surface"
                  size={44}
                  on={menuOpen}
                  onPress={() => setMenuOpen((was) => !was)}
                />
              ) : (
                <View style={styles.hudSide} />
              )}
            </View>
          </BlurBar>
          {menuOpen && currentPhoto ? (
            <Animated.View
              pointerEvents="box-none"
              style={[styles.menu, { top: layout.hudTop + 52, right: layout.hudSide }, menuStyle]}
            >
              {onDelete ? (
                <IconButton
                  icon={Trash2}
                  label={t('action.delete')}
                  tone="surface"
                  size={44}
                  onPress={deleteCurrent}
                />
              ) : null}
              {activeItem ? (
                <IconButton
                  icon={Download}
                  label={t('action.save')}
                  tone="surface"
                  size={44}
                  onPress={saveCurrent}
                />
              ) : null}
              {activeItem ? (
                originalProgress === null ? (
                  <IconButton
                    icon={originalLoaded ? ImageDown : Download}
                    label={t('action.original')}
                    tone="surface"
                    size={44}
                    on={originalLoaded}
                    onPress={toggleOriginal}
                  />
                ) : (
                  <View style={[styles.progressRound, { backgroundColor: theme.color.surface }]}>
                    <View style={[styles.progressTrack, { backgroundColor: theme.color.line }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: 28 * Math.max(0.05, originalProgress),
                            backgroundColor: theme.color.accent,
                          },
                        ]}
                      />
                    </View>
                  </View>
                )
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  off: {
    opacity: 0,
  },
  flight: {
    position: 'absolute',
  },
  info: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  fill: {
    flex: 1,
  },
  author: {
    position: 'absolute',
    left: space.s4,
    zIndex: 3,
  },
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.s4,
    minHeight: 44,
  },
  speedBar: {
    justifyContent: 'center',
  },
  hudWords: {
    alignItems: 'center',
    gap: 2,
  },
  hudBox: {
    maxWidth: '100%',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.s3,
    borderWidth: 1,
    borderRadius: radius.pill,
    gap: 1,
  },
  hudSide: {
    width: 44,
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menu: {
    position: 'absolute',
    alignItems: 'flex-end',
    gap: space.s2,
    zIndex: 6,
  },
  progressRound: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    width: 28,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  square: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
    borderRadius: radius.tile,
  },
});
