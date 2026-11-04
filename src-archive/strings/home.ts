import { count } from './plural';
export const en = {
  home: {
    title: 'Memories',
    account: 'Account',
    emptyTitle: 'Nothing here yet',
    empty:
      'Start a memory for your next event — and the photos will land here from everyone who was there.',
    noFrames: 'No frames yet — share the first ones',
    brought: (done: number, all: number) => `${done} of ${all} have already shared their frames`,
    create: 'New memory',
  },
  about: {
    lead: 'Mobile client.',
    apiUrl: 'API base URL',
    hint: 'Set EXPO_PUBLIC_API_URL to point the app elsewhere.',
    back: 'Back home',
  },
  create: {
    title: 'New memory',
    titleLabel: 'Title',
    titlePlaceholder: 'Anna’s birthday',
    eventDate: 'When it happened',
    dateHint: 'One day — one tap. Longer — the first day and the last.',
    today: 'Today',
    yesterday: 'Yesterday',
    weekend: 'Weekend',
    week: 'Week',
    days: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
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
    brought: (done: number, all: number) => `${done} из ${all} уже скинули свои кадры`,
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
