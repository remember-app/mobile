import { Image, type ImageRef } from 'expo-image';

import type { Movie, ProjectCard } from '@/models';
import type { ProjectId } from '@/types/id';

const BASE = {
  plain: require('../../../assets/wallpaper/background.png'),
  center: require('../../../assets/wallpaper/background-center.png'),
};

const STATE: Record<string, number> = {
  empty: require('../../../assets/logo/logo-heart-1-empty.png'),
  outline: require('../../../assets/logo/logo-heart-2-outline.png'),
  partial: require('../../../assets/logo/logo-heart-3-partial.png'),
  more: require('../../../assets/logo/logo-heart-4-more.png'),
  full: require('../../../assets/logo/logo-heart-5-full.png'),
  star: require('../../../assets/logo/logo-heart-6-star-open.png'),
  complete: require('../../../assets/logo/logo-heart-7-complete.png'),
};

const FILLED_AT_ITEMS = 5;
const SHARED_ENOUGH = 0.75;

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
 * Обои одного экрана: на главной и в профиле — плотный узор без свободного
 * центра, в воспоминании и на экране роликов — узор с пустым центром и
 * логотип поверх него.
 */
export function wallpaperFor(
  routeName: string,
  projectId: ProjectId | undefined,
  cards: readonly ProjectCard[],
  movies: readonly Movie[],
  loadedItems: number,
): Wallpaper {
  if (routeName === 'onboarding' || routeName === 'welcome') return solid;
  if (routeName === 'sign-up') return plain();

  if (routeName === 'home') {
    return cards.length > 0 ? plain() : centered(STATE.empty);
  }

  if (routeName.startsWith('project/[id]') && projectId) {
    if (routeName.endsWith('/movies')) {
      return centered(movies.length > 0 ? STATE.complete : STATE.star);
    }
    const card = cards.find((entry) => entry.id === projectId);
    if (!card) return plain();
    const shared = card.memberCount > 0 ? card.sharedCount / card.memberCount : 0;
    if (shared >= 1) return centered(movies.length > 0 ? STATE.complete : STATE.full);
    if (shared > SHARED_ENOUGH) return centered(STATE.more);
    if (Math.max(card.itemCount, loadedItems) > FILLED_AT_ITEMS) return centered(STATE.partial);
    return centered(STATE.outline);
  }

  return plain();
}
