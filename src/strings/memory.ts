import { count, form } from './plural';

/**
 * The words of a memory's settings — who is in it and on what footing, what the event is called and
 * when it was, and the end of it.
 */
export const en = {
  /** The guest list: who is in a memory, how to get more people in, and how to take somebody out. */
  members: {
    /** The heading of the block on the memory's settings. «Люди» and not «Участники»: the shorter word. */
    title: 'People',
    /**
     * Under that heading, and the organizer's whole progress: how many of the people who can bring
     * material already have. Counted over those alone — a viewer is nobody anybody is waiting on.
     */
    brought: (n: number, of: number) => `${n} of ${of} have brought everything`,
    /**
     * The way into taking somebody out — «своя кнопка, а не крестик, который всегда наготове». Two
     * labels because it is one control saying two things, the way the gallery's picking switch does.
     */
    edit: 'Edit the list',
    you: (name: string) => `${name} (you)`,
    remove: (name: string) => `Remove ${name}`,
    inviteTitle: 'Invite someone',
    mayAdd: 'They can add photos too',
    /** The rule over the chips of saved people standing under the username field, on the sheet. */
    fromContacts: 'From contacts',
    /**
     * The one button at the foot of that sheet. A shorter word than the footer's «Пригласить» in
     * Russian, and that is the point: the footer opens the sheet, this one puts a person in.
     */
    inviteDo: 'Invite',
    inviteLink: 'Invite link',
    getLink: 'Get the link',
    linkGrants: (role: string) => `Whoever follows it joins as «${role}».`,
    replaceLink: 'Replace the link',
    linkReplaced: 'New link ready. The old one no longer opens anything.',
    added: (name: string, role: string) => `Added ${name} — «${role}».`,
    already: (name: string, role: string) => `${name} is already here — still «${role}».`,
    noSuchUser: 'No one has that username.',
    inviteDenied: 'Only the organizer and people who can add photos may invite.',
    gone: 'They are not in this memory any more.',
    removeAsk: (name: string) => `Remove ${name}?`,
    removeText: 'Everything they uploaded here goes with them. There is no getting it back.',
    /** Spec 9: the price of the irreversible is named as a figure before the press, never after. */
    priceFrames: (n: number) =>
      `${n} ${n === 1 ? 'frame disappears' : 'frames disappear'} from this memory`,
    removeDo: 'Remove',
    keepThem: 'Keep them',
    /**
     * `SheetConfirmMember` over a viewer (spec 10.8.4): there is no material behind them, so there
     * is no price plate and no paragraph about one — what is lost is the looking.
     */
    removeViewerText: 'This person will not see the memory any more.',
  },

  /**
   * The memory's own settings (spec 8, `MemorySettings`): what the event is, who is in it, and the
   * one way to bring more people. The people used to be a face of the memory itself and live here
   * now, behind the capsule over the feed.
   */
  settings: {
    /** The bar, and deliberately not the memory's name: the name is on the card right under it. */
    title: 'Memory',
    /** The round pencil on that card — one button for all three of the things it changes. */
    edit: 'Change the name, the days and the cover',
    /** The block under the people, for whoever was only asked to look. */
    viewers: 'Viewers',
    /**
     * Your own standing, read out on the button that is it (spec 7.4): the word and then the fact
     * that pressing changes it, because a circle says neither on its own.
     */
    yourStanding: (standing: string) => `Your standing: ${standing}. Change it`,
    /**
     * The quiet trash at the right of the bar (spec 7.1, `MemorySettings`), read out. The organizer's
     * alone: nobody else is drawn it, and the api refuses them anyway.
     */
    delete: 'Delete the memory',
    /** `SheetConfirmMemory` — the heaviest question in the product: it takes everybody's archive. */
    deleteAsk: 'Delete the memory?',
    /**
     * Everybody inside is counted, viewers too — the way the capsule's «6 человек» counts (spec
     * 10.6). Alone in it, the organizer has nobody for it to disappear from.
     */
    deleteText: (people: number) =>
      people > 1
        ? `It disappears for ${people === 2 ? 'both' : `all ${people}`} people in it — frames, movies and montage journals. There is no getting it back.`
        : 'It disappears with its frames, movies and montage journals. There is no getting it back.',
    /** The plate: the part of the loss that was never the deleter's own, named as a figure. */
    deleteOthers: (frames: number) =>
      `Other people brought ${frames} ${frames === 1 ? 'frame' : 'frames'} here`,
    /** «Навсегда» is said here and over one frame, and nowhere else in the product. */
    deleteDo: 'Delete for good',
    keep: 'Keep it',
  },

  /**
   * Editing a memory (spec 10.8.3, `MemoryEdit` and `SheetCover`) — the name, the days and the
   * cover, all three at once. The heading pairs with «Новое воспоминание» on `Create` rather than
   * repeating the name of the screen it was opened from.
   */
  edit: {
    title: 'Edit the memory',
    save: 'Save',
    /** The banner that slides in over a failed save. Nothing typed is lost, and it says so by not mentioning it. */
    failed: 'Not saved. Check the connection and try again.',
    /** Under the name field once it has been emptied. The days are never empty — a calendar always holds a day. */
    noTitle: 'A memory cannot be saved without a name',
    /** The eyebrow over the block, and the sheet's own heading. */
    cover: 'Cover',
    /** Which frame is standing there — the day it was shot on, when the gallery has said. */
    coverFrom: (day: string) => `Frame from ${day}`,
    coverChosen: 'A frame of this memory',
    coverWhere: 'Shown in the list of memories',
    coverNone: 'No cover chosen',
    coverInstead: 'Otherwise the list shows a mosaic of the first frames',
    coverPick: 'Choose',
    coverReplace: 'Replace',
    /** Under the card, and only while there is one: putting it back costs nothing, so nothing asks. */
    coverDrop: 'Remove the cover',
    /** A memory with nothing in it has no frame to promote, and the button says so instead of opening an empty sheet. */
    coverNeedsFrames: 'You need at least one frame first',
    coverDo: 'Make it the cover',
    /** Walking away from edits nobody saved — the gentle sheet, where nothing is lost and nothing is red. */
    leaveAsk: 'Leave without saving?',
    leaveText: 'The name, the days and the cover stay as they were.',
    leaveDo: 'Leave',
    stay: 'Stay',
  },
};

export const ru: typeof en = {
  members: {
    title: 'Люди',
    brought: (n: number, of: number) => `${n} из ${of} всё скинули`,
    edit: 'Править состав',
    you: (name: string) => `${name} (вы)`,
    remove: (name: string) => `Убрать ${name}`,
    inviteTitle: 'Позвать человека',
    mayAdd: 'Сможет добавлять фото',
    fromContacts: 'Из контактов',
    inviteDo: 'Позвать',
    inviteLink: 'Ссылка-приглашение',
    getLink: 'Получить ссылку',
    linkGrants: (role: string) => `Кто перейдёт по ней, войдёт как «${role}».`,
    replaceLink: 'Заменить ссылку',
    linkReplaced: 'Новая ссылка готова. Старая больше ничего не открывает.',
    added: (name: string, role: string) => `Добавили ${name} — «${role}».`,
    already: (name: string, role: string) => `${name} уже здесь — по-прежнему «${role}».`,
    noSuchUser: 'Никто не носит такой ник.',
    inviteDenied: 'Звать людей могут организатор и те, кто может добавлять фото.',
    gone: 'Этого человека здесь уже нет.',
    removeAsk: (name: string) => `Убрать ${name}?`,
    removeText:
      'Всё, что этот человек сюда загрузил, уйдёт вместе с ним. Вернуть это не получится.',
    priceFrames: (n: number) =>
      `${count(n, 'кадр', 'кадра', 'кадров')} ${
        n % 10 === 1 && n % 100 !== 11 ? 'исчезнет' : 'исчезнут'
      } из воспоминания`,
    removeDo: 'Убрать',
    keepThem: 'Оставить',
    removeViewerText: 'Этот человек больше не увидит воспоминание.',
  },

  settings: {
    title: 'Воспоминание',
    edit: 'Изменить название, даты и обложку',
    viewers: 'Зрители',
    yourStanding: (standing: string) => `Ваш статус: ${standing.toLowerCase()}. Изменить`,
    delete: 'Удалить воспоминание',
    deleteAsk: 'Удалить воспоминание?',
    // «У всех 21 участника», но «у всех 5 участников»: после «всех» число стоит в родительном.
    deleteText: (people: number) =>
      people > 1
        ? `Оно исчезнет у ${
            people === 2
              ? 'обоих участников'
              : `всех ${people} ${form(people, 'участника', 'участников', 'участников')}`
          } — кадры, ролики и журналы монтажа. Вернуть будет нельзя.`
        : 'Оно исчезнет вместе с кадрами, роликами и журналами монтажа. Вернуть будет нельзя.',
    deleteOthers: (frames: number) =>
      `${count(frames, 'кадр', 'кадра', 'кадров')} сюда принесли другие`,
    deleteDo: 'Удалить навсегда',
    keep: 'Оставить',
  },

  edit: {
    title: 'Изменить воспоминание',
    save: 'Сохранить',
    failed: 'Не сохранили. Проверьте связь и попробуйте ещё раз.',
    noTitle: 'Без названия не сохранить',
    cover: 'Обложка',
    coverFrom: (day: string) => `Кадр от ${day}`,
    coverChosen: 'Кадр этого воспоминания',
    coverWhere: 'Видна в списке воспоминаний',
    coverNone: 'Обложка не выбрана',
    coverInstead: 'Иначе в списке видна мозаика из первых кадров',
    coverPick: 'Выбрать',
    coverReplace: 'Заменить',
    coverDrop: 'Снять обложку',
    coverNeedsFrames: 'Сначала нужен хотя бы один кадр',
    coverDo: 'Поставить обложкой',
    leaveAsk: 'Уйти без сохранения?',
    leaveText: 'Название, даты и обложка останутся прежними.',
    leaveDo: 'Уйти',
    stay: 'Остаться',
  },
};
