import { Image, type ImageRef } from 'expo-image';

import type { Item, Montage, Movie, ProjectCard } from '@/models';
import type { ProjectId } from '@/types/id';

const BASE = {
  plain: require('../../../../assets/wallpaper/background.png'),
  center: require('../../../../assets/wallpaper/background-center.png'),
};

const STATE: Record<string, number> = {
  empty: require('../../../../assets/logo/logo-heart-1-empty.png'),
  outline: require('../../../../assets/logo/logo-heart-2-outline.png'),
  star: require('../../../../assets/logo/logo-heart-6-star-open.png'),
  complete: require('../../../../assets/logo/logo-heart-7-complete.png'),
};

export type Wallpaper = { base: ImageRef | number | null; state: number | null };

let decoded: Record<keyof typeof BASE, ImageRef> | null = null;

/**
 * Декодирует обои до первого экрана. Готовая картинка отдаётся экрану как
 * есть, поэтому он выезжает с узором сразу, а не проявляет его поверх старого.
 */
export async function preloadWallpapers(): Promise<void> {
  try {
    const [plain, center] = await Promise.all([
      Image.loadAsync(BASE.plain),
      Image.loadAsync(BASE.center),
    ]);
    decoded = { plain, center };
  } catch {
    // без обоев экран останется на сплошном фоне
  }
}

const base = (kind: keyof typeof BASE): ImageRef | number => decoded?.[kind] ?? BASE[kind];
const solid: Wallpaper = { base: null, state: null };
const plain = (): Wallpaper => ({ base: base('plain'), state: null });
const centered = (state: number | null): Wallpaper => ({ base: base('center'), state });

/**
 * Обои одного экрана: узор с пустым центром и логотип поверх него — только на
 * пустых экранах, где больше нечего показать. Везде, где есть наполнение,
 * ставится плотный узор без свободного центра.
 */
export function wallpaperFor(
  routeName: string,
  projectId: ProjectId | undefined,
  cards: readonly ProjectCard[],
  movies: readonly Movie[],
  montages: readonly Montage[],
  items: readonly Item[],
): Wallpaper {
  if (routeName === 'onboarding' || routeName === 'welcome') return solid;
  if (routeName === 'sign-up') return plain();
  if (routeName === 'project/[id]/settings') return plain();

  if (routeName === 'home') {
    return cards.length > 0 ? plain() : centered(STATE.empty);
  }

  if (projectId) {
    const card = cards.find((entry) => entry.id === projectId);

    if (routeName === 'project/[id]' || routeName === 'project/[id]/info') {
      if (!card) return plain();
      return Math.max(card.itemCount, items.length) > 0 ? plain() : centered(STATE.outline);
    }
    if (routeName === 'project/[id]/movies') {
      return movies.length > 0 || montages.length > 0 ? plain() : centered(STATE.star);
    }
    if (routeName === 'project/[id]/analyze') {
      const done = items.length > 0 && items.every((item) => item.analysis !== null);
      return done ? centered(STATE.complete) : plain();
    }
  }

  return plain();
}
