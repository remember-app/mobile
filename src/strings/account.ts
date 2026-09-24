import { count } from './plural';

/**
 * The words of the account — the profile, the people one knows by name, the nick they are found by,
 * and the two picks that change how the whole app looks and speaks.
 */
export const en = {
  /** The account: who you are here, what the app is set to, and the way out. */
  profile: {
    title: 'Account',
    /**
     * Under «Contacts» on the section row that leads there: what the list is worth opening for, said
     * as what it saves rather than as what it holds.
     */
    contactsMeta: (n: number) =>
      `${n} ${n === 1 ? 'person' : 'people'} — invite by picking, without remembering a username`,
  },

  /**
   * The one list a person keeps about themselves rather than about an event (doc-10): the names
   * they invite from, so a username never has to be remembered or typed twice. Not friends — nobody
   * on it is asked, told or granted anything, which is why there is no word here for a request, a
   * standing or a count. «Такого ника нет» is `members.noSuchUser`: one fact, one wording, whether
   * the invite sheet or this field is the one that found nothing.
   */

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
   * The one username field, shared by the first claim and the change. There is no heading over it
   * any more: the onboarding head says where a person is (spec 8, `Username`), and `lead` is the
   * line under the field saying what the name is for.
   */

  /**
   * The one username field, shared by the first claim and the change. There is no heading over it
   * any more: the onboarding head says where a person is (spec 8, `Username`), and `lead` is the
   * line under the field saying what the name is for.
   */
  username: {
    label: 'Username',
    placeholder: 'username',
    free: 'Username is free.',
    lead: 'This is how other people find you in a memory.',
    continue: 'Continue',
  },

  /**
   * The two languages name themselves. A person looking for their own language reads it in that
   * language, so these two lines are the same in both sets on purpose.
   */

  /**
   * The two languages name themselves. A person looking for their own language reads it in that
   * language, so these two lines are the same in both sets on purpose.
   */
  language: {
    label: 'Language',
    ru: 'Русский',
    en: 'English',
    /** Where the pick reaches past this screen — the mails and the pushes the api writes (TASK-91). */
    hint: 'Letters and notifications come in it too.',
  },

  /** doc-9. The third one is not a light but the phone going on deciding. */

  /** doc-9. The third one is not a light but the phone going on deciding. */
  theme: {
    label: 'Theme',
    system: 'As on phone',
    dark: 'Dark',
    light: 'Light',
    hint: 'Changes at once — this screen is the sample.',
  },
};

export const ru: typeof en = {
  profile: {
    title: 'Аккаунт',
    contactsMeta: (n: number) =>
      `${count(n, 'человек', 'человека', 'человек')} — зовите выбором, не вспоминая ник`,
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
    continue: 'Продолжить',
  },

  language: {
    label: 'Язык',
    ru: 'Русский',
    en: 'English',
    hint: 'На нём же приходят письма и уведомления.',
  },

  theme: {
    label: 'Тема',
    system: 'Как в телефоне',
    dark: 'Тёмная',
    light: 'Светлая',
    hint: 'Меняется сразу — этот экран и есть образец.',
  },
};
