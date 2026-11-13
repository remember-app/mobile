import type { Movie, ProjectCard } from '@/models';
import type { ProjectId } from '@/types/id';

const WALLPAPERS: Record<string, number> = {
  plain: require('../../../assets/wallpaper/background.png'),
  empty: require('../../../assets/wallpaper/logo-heart-1-empty.png'),
  outline: require('../../../assets/wallpaper/logo-heart-2-outline.png'),
  partial: require('../../../assets/wallpaper/logo-heart-3-partial.png'),
  more: require('../../../assets/wallpaper/logo-heart-4-more.png'),
  full: require('../../../assets/wallpaper/logo-heart-5-full.png'),
  star: require('../../../assets/wallpaper/logo-heart-6-star-open.png'),
  complete: require('../../../assets/wallpaper/logo-heart-7-complete.png'),
};

const HOME_FILLED_AT_ITEMS = 5;
const SHARED_ENOUGH = 0.75;

/**
 * Обои по месту приложения: на главной и в профиле — узор без логотипа,
 * в воспоминании — сердце по прогрессу, на экране роликов — звезда или
 * полный логотип.
 */
export function wallpaperFor(
  pathname: string,
  cards: readonly ProjectCard[],
  movies: readonly Movie[],
  loadedItems: number,
): number {
  const [, section, id, page] = pathname.split('/');

  if (section === 'home' || !section) {
    return cards.length > 0 ? WALLPAPERS.plain : WALLPAPERS.empty;
  }

  if (section === 'project' && id) {
    if (page === 'movies') {
      return movies.length > 0 ? WALLPAPERS.complete : WALLPAPERS.star;
    }
    const card = cards.find((entry) => entry.id === (id as ProjectId));
    if (!card) return WALLPAPERS.plain;
    const shared = card.memberCount > 0 ? card.sharedCount / card.memberCount : 0;
    if (shared >= 1) return movies.length > 0 ? WALLPAPERS.complete : WALLPAPERS.full;
    if (shared > SHARED_ENOUGH) return WALLPAPERS.more;
    if (Math.max(card.itemCount, loadedItems) > HOME_FILLED_AT_ITEMS) return WALLPAPERS.partial;
    return WALLPAPERS.outline;
  }

  return WALLPAPERS.plain;
}
