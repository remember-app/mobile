import { count } from './plural';

/**
 * The words of the main screen — one's own memories, what stands there when there are none yet, and
 * what the sheet that starts a new one asks for.
 */
export const en = {
  /** The main screen: every memory this account organizes or was invited to. */
  home: {
    title: 'Memories',
    /**
     * The one button in the header (spec 8, `Main`) and everything about you behind it — the
     * contact list moved inside it, so there is no second icon here to name any more.
     */
    account: 'Account',
    /** `HomeEmpty`, and the first thing anybody sees after signing up: a heading and an invitation. */
    emptyTitle: 'Nothing here yet',
    empty:
      'Start a memory for your next event — and the photos will land here from everyone who was there.',
    /** A memory with nothing in it at all — said on the film of its own card. */
    noFrames: 'No frames yet — share the first ones',
    /** Under the bar on a large card: how many of the guests have brought their frames in. */
    brought: (done: number, all: number) => `${done} of ${all} have already shared their frames`,
    /**
     * `HomeOffline` — said over a list that is still there. The screen goes on working; what it
     * cannot promise is that this is the latest, and that is the whole sentence.
     */
    offline: 'No connection to the server. Showing what is already loaded.',
    /** `HomeOnline` — one line with no way to dismiss it, because it leaves on its own. */
    online: 'Connected',
    create: 'New memory',
  },

  /** The service page. «Remember» is the product's name and stays itself in both languages. */
  about: {
    lead: 'Mobile client.',
    apiUrl: 'API base URL',
    hint: 'Set EXPO_PUBLIC_API_URL to point the app elsewhere.',
    back: 'Back home',
  },

  /**
   * The way in. The provider names are trademarks and stay as they are written, and the screen's
   * one heading is the product's own name (TASK-77) — which is not a word either language owns.
   */

  /** Starting a memory: a title and the day (or span) the event happened on. */
  create: {
    title: 'New memory',
    titleLabel: 'Title',
    titlePlaceholder: 'Anna’s birthday',
    /** The `eyebrow` over the calendar, and the whole question the block below it asks. */
    eventDate: 'When it happened',
    /**
     * The one line under the calendar (spec 7.3, detail 15). It says how the thing works rather than
     * why it is asked for: there is no switch for «longer than a day» any more, and the second tap
     * is what nobody would find on their own.
     */
    dateHint: 'One day — one tap. Longer — the first day and the last.',
    /** The four quick days over the calendar, each one a whole answer. */
    today: 'Today',
    yesterday: 'Yesterday',
    weekend: 'Weekend',
    week: 'Week',
    /** «· 3 дня» beside the picked span. A single day never says it — it is a date, not a length. */
    days: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    /** What the calendar's two round buttons are called, since it knows no words of its own. */
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    submit: 'Create',
  },
};

export const ru: typeof en = {
  home: {
    title: 'Воспоминания',
    account: 'Аккаунт',
    emptyTitle: 'Здесь пока пусто',
    empty:
      'Заведите воспоминание к ближайшему событию — и снимки начнут стекаться сюда от всех, кто там был.',
    noFrames: 'Ни одного кадра — скиньте первые',
    // Про людей, а не про файлы: считаются те, кто ответил за свой материал, — и сказано это
    // так же, как на «Людях» воспоминания.
    brought: (done: number, all: number) => `${done} из ${all} уже скинули свои кадры`,
    offline: 'Нет связи с сервером. Показываем то, что уже загружено.',
    online: 'Соединение установлено',
    create: 'Новое воспоминание',
  },

  about: {
    lead: 'Мобильный клиент.',
    apiUrl: 'Адрес сервера',
    hint: 'Чтобы указать другой сервер, задайте EXPO_PUBLIC_API_URL.',
    back: 'На главную',
  },

  create: {
    title: 'Новое воспоминание',
    titleLabel: 'Название',
    titlePlaceholder: 'День рождения Анны',
    eventDate: 'Когда это было',
    dateHint: 'Один день — одно касание. Несколько — первый и последний.',
    today: 'Сегодня',
    yesterday: 'Вчера',
    weekend: 'Выходные',
    week: 'Неделя',
    days: (n: number) => count(n, 'день', 'дня', 'дней'),
    prevMonth: 'Предыдущий месяц',
    nextMonth: 'Следующий месяц',
    submit: 'Создать',
  },
};
