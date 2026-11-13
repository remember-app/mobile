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

export type Wallpaper = { base: number; state: number | null };

const plain: Wallpaper = { base: BASE.plain, state: null };
const centered = (state: number): Wallpaper => ({ base: BASE.center, state });

/**
 * Обои по месту приложения: на главной и в профиле — плотный узор без
 * свободного центра, в воспоминании и на экране роликов — узор с пустым
 * центром и логотип поверх него.
 */
export function wallpaperFor(
  pathname: string,
  cards: readonly ProjectCard[],
  movies: readonly Movie[],
  loadedItems: number,
): Wallpaper {
  const [, section, id, page] = pathname.split('/');

  if (section === 'home' || !section) {
    return cards.length > 0 ? plain : centered(STATE.empty);
  }

  if (section === 'project' && id) {
    if (page === 'movies') {
      return centered(movies.length > 0 ? STATE.complete : STATE.star);
    }
    const card = cards.find((entry) => entry.id === (id as ProjectId));
    if (!card) return plain;
    const shared = card.memberCount > 0 ? card.sharedCount / card.memberCount : 0;
    if (shared >= 1) return centered(movies.length > 0 ? STATE.complete : STATE.full);
    if (shared > SHARED_ENOUGH) return centered(STATE.more);
    if (Math.max(card.itemCount, loadedItems) > FILLED_AT_ITEMS) return centered(STATE.partial);
    return centered(STATE.outline);
  }

  return plain;
}
