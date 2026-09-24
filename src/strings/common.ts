import { count } from './plural';

/**
 * The words said on more than one screen: one action, one word, and the same word wherever the
 * action turns up. Nothing here belongs to a screen — everything here is said on several.
 */
export const en = {
  /** One action, one word — the same word wherever the action appears. */
  action: {
    back: 'Back',
    cancel: 'Cancel',
    /** Putting a whole selection back — the quiet half of every footer that picks something. */
    clear: 'Clear',
    close: 'Close',
    /** The way out of a sheet that changes what is on screen while it is open. */
    done: 'Done',
    retry: 'Try again',
    delete: 'Delete',
    download: 'Download',
    /** Keeping what is on screen — the finished movie onto the phone it is watched on. */
    save: 'Save',
    share: 'Share',
    invite: 'Invite',
    send: 'Send',
    /**
     * The account and nothing else: leaving a memory is not offered anywhere anymore (TASK-113), and
     * the kit's screen 8 spells out which of the two exits this is.
     */
    logOut: 'Log out of your account',
    openSettings: 'Open settings',
    /** The 32 cross on the connection banner — the only way to put a message away by hand. */
    hide: 'Hide message',
  },

  /** What a screen says while it has nothing to show yet. */

  /** What a screen says while it has nothing to show yet. */
  state: {
    loading: 'Loading…',
    gathering: 'Gathering your memories…',
    checking: 'Checking…',
    sending: 'Sending',
    preparing: 'Preparing the frames…',
    signingIn: 'Signing you in…',
    joining: 'Joining…',
  },

  /** Trouble: what happened, and what to do about it. */

  /** Trouble: what happened, and what to do about it. */
  error: {
    offline: 'Cannot reach the API — check that it is running and try again.',
    tooMany: 'Too many attempts — wait a minute and try again.',
    status: (status: number) => `The API answered ${status}.`,
    usernameTaken: 'That username is taken — pick another.',
    usernameFormat: '3–30 Latin letters, digits, . _ -, and not at the ends',
    galleryRefused: 'Remember may not add to this phone’s gallery — that is turned on in Settings.',
  },

  /** The product's own nouns, and the counts drawn next to them. */

  /** The product's own nouns, and the counts drawn next to them. */
  memory: {
    /**
     * The appbar of any screen of a memory before the memory itself has arrived — its own title
     * takes over then. One line for all four of them, so none of them stands under a different word
     * while it waits.
     */
    fallbackTitle: 'Memory',
    /**
     * The capsule of the glass bar said out loud (spec 8): it carries the memory's name and leads
     * into its settings, and the name alone would not say that it leads anywhere.
     */
    settings: (title: string) => `${title}. Memory settings and people`,
    /** The second line of that capsule while there is nothing in the memory yet (`FramesEmpty`). */
    nothingYet: 'nothing yet',
    /** Whoever brought a frame and is no longer on the roster. */
    someone: 'Someone',
    /**
     * What everybody put in, under the one word the whole app calls it by — the kit allows a thing
     * exactly one name, and this one had three (TASK-76): «frames» on the card, «Photos and videos»
     * on the guest list, «Gallery» over the contact sheet. «Video» stays what one record is
     * (`media.video`), never what a memory is full of.
     */
    frames: (n: number) => `${n} ${n === 1 ? 'frame' : 'frames'}`,
    /** The same word with nothing counted yet: a section's name, and a button before its count. */
    framesPlain: 'Frames',
    people: (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`,
    /**
     * A 404 from the memory's own check — with nothing else in the path that could be the one
     * missing, it means this person is not in the memory (any more). Every screen of a memory that
     * meets it says the same.
     */
    gone: 'You are no longer in this memory.',
  },

  /** What one record is, said out loud — the tile's own name for a screen reader. */

  /** What one record is, said out loud — the tile's own name for a screen reader. */
  media: { photo: 'Photo', video: 'Video' },

  /**
   * Putting a file on the phone, said the same by both screens that do it (`@/lib/downloads`): the
   * gallery saves originals one at a time and by the armful, the montage screen saves the video.
   */

  /**
   * Putting a file on the phone, said the same by both screens that do it (`@/lib/downloads`): the
   * gallery saves originals one at a time and by the armful, the montage screen saves the video.
   */
  save: {
    one: 'Saving…',
    montage: 'Saving to your gallery…',
    nth: (index: number, total: number) => `Saving ${index} of ${total}…`,
    done: 'Saved to your gallery.',
    all: (n: number) => `Saved ${n} to your gallery.`,
    some: (saved: number, total: number) =>
      `Saved ${saved} of ${total} — try again for what is missing.`,
    failedOne: 'Could not save this one to your gallery.',
    failedAll: 'Could not save this gallery to your phone.',
    failedMontage: 'Could not save this movie to your phone.',
  },

  /**
   * The three levels of doc-01 «Права доступа», keyed by what the api calls them. One word each,
   * as in section 7 of the kit: the chip stands at the end of a member row and every letter it
   * takes is a letter the name and the standing beside it lose.
   */

  /**
   * The three levels of doc-01 «Права доступа», keyed by what the api calls them. One word each,
   * as in section 7 of the kit: the chip stands at the end of a member row and every letter it
   * takes is a letter the name and the standing beside it lose.
   */
  role: { organizer: 'Organizer', contributor: 'Contributor', viewer: 'Viewer' },

  /**
   * The four standings of doc-06 — «прогресс у организатора», keyed by the api's own values. Three
   * words on screen, not four: the first two both read as «still to come», because the difference
   * between «has not started» and «is still adding» is the api's bookkeeping and not anything the
   * organizer does differently — the count beside the standing already says how far along they are
   * (doc-06, уточнено 2026-09-08).
   */

  /**
   * The four standings of doc-06 — «прогресс у организатора», keyed by the api's own values. Three
   * words on screen, not four: the first two both read as «still to come», because the difference
   * between «has not started» and «is still adding» is the api's bookkeeping and not anything the
   * organizer does differently — the count beside the standing already says how far along they are
   * (doc-06, уточнено 2026-09-08).
   */
  standing: {
    not_started: 'Planning to upload',
    more_coming: 'Planning to upload',
    done: 'All uploaded',
    nothing: 'Nothing to add',
  },

  /** The main screen: every memory this account organizes or was invited to. */
};

export const ru: typeof en = {
  action: {
    back: 'Назад',
    cancel: 'Отмена',
    clear: 'Снять',
    close: 'Закрыть',
    done: 'Готово',
    retry: 'Повторить',
    delete: 'Удалить',
    download: 'Скачать',
    save: 'Сохранить',
    share: 'Поделиться',
    invite: 'Пригласить',
    send: 'Отправить',
    logOut: 'Выйти из аккаунта',
    openSettings: 'Открыть настройки',
    hide: 'Скрыть сообщение',
  },

  state: {
    loading: 'Загружаем…',
    gathering: 'Собираем ваши воспоминания…',
    checking: 'Проверяем…',
    sending: 'Отправляем',
    // The kit develops frames rather than preparing them, and the Russian keeps the darkroom.
    preparing: 'Проявляем кадры…',
    signingIn: 'Впускаем…',
    joining: 'Присоединяем…',
  },

  error: {
    offline: 'Не получилось связаться с сервером — проверьте, что он запущен, и повторите.',
    tooMany: 'Слишком много попыток — подождите минуту и повторите.',
    status: (status: number) => `Сервер ответил ${status}.`,
    usernameTaken: 'Этот ник уже занят — выберите другой.',
    usernameFormat:
      'От 3 до 30 знаков: латиница, цифры, точка, дефис и подчёркивание — не по краям',
    galleryRefused: 'Remember не может сохранять в галерею телефона — это включается в настройках.',
  },

  memory: {
    fallbackTitle: 'Воспоминание',
    settings: (title: string) => `${title}. Настройки воспоминания и люди`,
    nothingYet: 'пока пусто',
    someone: 'Кто-то',
    // «Кадры» — то самое слово кита, и теперь единственное: и карточка на главной, и переключатель
    // лиц воспоминания называют материал одинаково.
    frames: (n: number) => count(n, 'кадр', 'кадра', 'кадров'),
    framesPlain: 'Кадры',
    people: (n: number) => count(n, 'человек', 'человека', 'человек'),
    gone: 'Вас больше нет в этом воспоминании.',
  },

  media: { photo: 'Фото', video: 'Видео' },

  save: {
    one: 'Сохраняем…',
    montage: 'Сохраняем в галерею…',
    nth: (index: number, total: number) => `Сохраняем ${index} из ${total}…`,
    done: 'Сохранили в галерею телефона.',
    all: (n: number) => `Сохранили ${count(n, 'файл', 'файла', 'файлов')} в галерею.`,
    some: (saved: number, total: number) =>
      `Сохранили ${saved} из ${total} — повторите, чтобы забрать остальное.`,
    failedOne: 'Не получилось сохранить это в галерею телефона.',
    failedAll: 'Не получилось сохранить галерею на телефон.',
    failedMontage: 'Не получилось сохранить ролик на телефон.',
  },

  role: { organizer: 'Организатор', contributor: 'Добавление', viewer: 'Просмотр' },

  standing: {
    not_started: 'Планирует загрузить',
    more_coming: 'Планирует загрузить',
    done: 'Всё загрузил',
    nothing: 'Нечего добавлять',
  },
};
