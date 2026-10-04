/**
 * The words of the account — the profile, the people one knows by name, the nick they are found by,
 * and the two picks that change how the whole app looks and speaks.
 */
export const en = {
  /** The account: who you are here, what the app is set to, and the way out. */
  profile: {
    title: 'Account',
    /**
     * The pencil on the profile card, read out, and the heading of the sheet it opens. The username
     * is the one thing about a person the product lets them change (doc-04): no name, no picture,
     * and the address is the one they signed in with.
     */
    edit: 'Change username',
    /**
     * Under the count on the «Contacts» card: what the list is worth opening for, said as what it
     * saves rather than as what it holds.
     */
    contactsMeta: 'Invite by picking, not by username',
    /** The heading over the one setting of every feed of every memory. */
    gallery: 'Gallery',
    datesBetweenDays: 'Dates between days',
    /** The heading over the density of every gallery — the pills are the counts themselves (doc-12). */
    density: 'Frames per row',
    /** Leaving loses nothing, and the sheet says so (spec 8, `Account`). */
    logOutAsk: 'Log out of your account?',
    logOutText: 'Your frames stay in the memories.',
    logOutDo: 'Log out',
    stay: 'Stay',
  },

  /**
   * The one list a person keeps about themselves rather than about an event (doc-10): the names
   * they invite from, so a username never has to be remembered or typed twice. Not friends — nobody
   * on it is asked, told or granted anything, which is why there is no word here for a request, a
   * standing or a count. «Такого ника нет» is `members.noSuchUser`: one fact, one wording, whether
   * the invite sheet or this field is the one that found nothing.
   */
  contacts: {
    title: 'Contacts',
    /** The rule over the row the field turned up when what was typed is somebody else. */
    notSaved: 'Not in contacts',
    /** The heading of the list itself, with the count of it on the end of its own rule. */
    saved: 'Saved',
    save: 'Save',
    /** The cross on a row, read out with the name it takes off the list. */
    remove: (name: string) => `Remove ${name} from contacts`,
    /**
     * What the row says while it waits to be let go — spoken about the list and not about the
     * person, because nothing here knows whether that person is a он or a она.
     */
    removed: 'Removed from contacts',
    undo: 'Bring back',
    /** The heading names what is missing; the paragraph sends them to the field over it. */
    emptyTitle: 'Nobody here yet',
    empty:
      'Type a username in the field above — next time you invite that person by picking, without remembering anything.',
    /** Nothing saved matches, and nobody in Remember holds the name either. */
    noUser: (username: string) => `No one is @${username} in Remember.`,
  },

  /**
   * The one username field, shared by the first claim and the change. On the sheet of the change,
   * `free` and `lead` are the line under the field; on the way in (spec 8, `Username`) the answer is
   * one word over it — `available`, `taken` — and what the name is for is said by the step's head.
   */
  username: {
    label: 'Username',
    placeholder: 'username',
    free: 'Username is free.',
    lead: 'This is how other people find you in a memory.',
    available: 'Free',
    taken: 'Taken',
    title: 'What should we call you',
    intro:
      'In a memory, people call you in by picking you from a list. A username is how they find you.',
    continue: 'Continue',
  },

  /**
   * The two languages name themselves. A person looking for their own language reads it in that
   * language, so these two lines are the same in both sets on purpose.
   */
  language: {
    label: 'Language',
    ru: 'Русский',
    en: 'English',
  },

  /** doc-9. The third one is not a light but the phone going on deciding. */
  theme: {
    label: 'Theme',
    system: 'System',
    dark: 'Dark',
    light: 'Light',
  },
};

export const ru: typeof en = {
  profile: {
    title: 'Аккаунт',
    edit: 'Изменить ник',
    contactsMeta: 'Зовите выбором, не по нику',
    gallery: 'Галерея',
    datesBetweenDays: 'Даты между днями',
    density: 'Кадров в ряду',
    logOutAsk: 'Выйти из аккаунта?',
    logOutText: 'Кадры останутся в воспоминаниях.',
    logOutDo: 'Выйти',
    stay: 'Остаться',
  },

  contacts: {
    title: 'Контакты',
    notSaved: 'Не в контактах',
    saved: 'Сохранённые',
    save: 'Сохранить',
    remove: (name: string) => `Убрать ${name} из контактов`,
    removed: 'Убрали из контактов',
    undo: 'Вернуть',
    emptyTitle: 'Пока никого',
    empty:
      'Наберите ник в поле сверху — и в следующий раз позовёте человека выбором, не вспоминая.',
    noUser: (username: string) => `Ника @${username} в Remember нет.`,
  },

  username: {
    label: 'Ник',
    placeholder: 'ник',
    free: 'Ник свободен.',
    lead: 'По нему вас найдут в воспоминании.',
    available: 'Свободен',
    taken: 'Занят',
    title: 'Как вас звать',
    intro: 'В воспоминании вас зовут выбором из списка. Ник — чтобы вас нашли по нему.',
    continue: 'Продолжить',
  },

  language: {
    label: 'Язык',
    ru: 'Русский',
    en: 'English',
  },

  theme: {
    label: 'Тема',
    system: 'Как в системе',
    dark: 'Тёмная',
    light: 'Светлая',
  },
};
