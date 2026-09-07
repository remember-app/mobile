/**
 * Everything the app says, in the two languages it speaks (doc-8). One key, two sets, both written
 * by hand: the English is not a translation of the Russian and the Russian is not a translation of
 * the English — each is written the way that language says the thing. The kit's vocabulary is the
 * law on the Russian side: воспоминание, кадры, участники, ролик, and one word per action.
 *
 * `en` fixes the shape and `ru` has to fill it, so a key that gains a set and not the other stops
 * the typecheck rather than showing an English word inside a Russian screen.
 *
 * What is here is what the app says outside its screens — errors, states, the words that repeat on
 * every screen. The screens' own text moves in with TASK-86, which is also what starts reading
 * these; nothing imports them yet.
 */

/**
 * Russian counts in three forms where English has two: 1 кадр, 2 кадра, 5 кадров. The rule is the
 * language's own and never changes, so it is four lines here rather than `Intl.PluralRules`, which
 * Hermes does not carry on every platform.
 */
function count(n: number, one: string, few: string, many: string): string {
  const teen = n % 100 >= 11 && n % 100 <= 14;
  const last = n % 10;
  return `${n} ${teen ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many}`;
}

export const en = {
  /** One action, one word — the same word wherever the action appears. */
  action: {
    back: 'Back',
    cancel: 'Cancel',
    close: 'Close',
    retry: 'Try again',
    delete: 'Delete',
    download: 'Download',
    share: 'Share',
    invite: 'Invite',
    send: 'Send',
    logOut: 'Log out',
    openSettings: 'Open settings',
  },

  /** What a screen says while it has nothing to show yet. */
  state: {
    loading: 'Loading…',
    gathering: 'Gathering your memories…',
    checking: 'Checking…',
    sending: 'Sending',
    preparing: 'Preparing the frames…',
  },

  /** Trouble: what happened, and what to do about it. */
  error: {
    offline: 'Cannot reach the API — check that it is running and try again.',
    tooMany: 'Too many attempts — wait a minute and try again.',
    status: (status: number) => `The API answered ${status}.`,
    usernameTaken: 'That username is taken — pick another.',
    usernameFormat: '3–30 Latin letters, digits, . _ -, and not at the ends',
    galleryRefused:
      'Remember may not add to this phone’s gallery — that is turned on in Settings.',
  },

  /** The product's own nouns, and the counts drawn next to them. */
  memory: {
    /** Whoever brought a frame and is no longer on the roster. */
    someone: 'Someone',
    frames: (n: number) => `${n} ${n === 1 ? 'frame' : 'frames'}`,
    people: (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`,
  },

  /**
   * The two languages name themselves. A person looking for their own language reads it in that
   * language, so these two lines are the same in both sets on purpose.
   */
  language: { ru: 'Русский', en: 'English' },
};

/** The shape both sets keep. */
export type Strings = typeof en;

export const ru: Strings = {
  action: {
    back: 'Назад',
    cancel: 'Отмена',
    close: 'Закрыть',
    retry: 'Повторить',
    delete: 'Удалить',
    download: 'Скачать',
    share: 'Поделиться',
    invite: 'Пригласить',
    send: 'Отправить',
    logOut: 'Выйти',
    openSettings: 'Открыть настройки',
  },

  state: {
    loading: 'Загружаем…',
    gathering: 'Собираем ваши воспоминания…',
    checking: 'Проверяем…',
    sending: 'Отправляем',
    // The kit develops frames rather than preparing them, and the Russian keeps the darkroom.
    preparing: 'Проявляем кадры…',
  },

  error: {
    offline: 'Не получилось связаться с сервером — проверьте, что он запущен, и повторите.',
    tooMany: 'Слишком много попыток — подождите минуту и повторите.',
    status: (status: number) => `Сервер ответил ${status}.`,
    usernameTaken: 'Этот ник уже занят — выберите другой.',
    usernameFormat: 'От 3 до 30 знаков: латиница, цифры, точка, дефис и подчёркивание — не по краям',
    galleryRefused: 'Remember не может сохранять в галерею телефона — это включается в настройках.',
  },

  memory: {
    someone: 'Кто-то',
    frames: (n: number) => count(n, 'кадр', 'кадра', 'кадров'),
    people: (n: number) => count(n, 'человек', 'человека', 'человек'),
  },

  language: { ru: 'Русский', en: 'English' },
};

/** Both sets, by the language they belong to. */
export const strings = { en, ru };
