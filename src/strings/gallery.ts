import { count } from './plural';

/**
 * The words of the feed of frames — the sorting, the filtering and the picking, the window one frame
 * opens in, and the labels a frame is filed under.
 */
export const en = {
  /**
   * The contact sheet, and the open frame over it. What the screen is *called* is not here: it is
   * the memory's own title, over `memory.framesPlain` — the same word the card and the guest list
   * use for the material (TASK-76).
   */
  gallery: {
    /** Spec «Пусто и необратимое»: the heading names what is missing, the line under it says what to do. */
    emptyTitle: 'Not a single frame',
    empty: 'Whatever anybody adds lands here. Start with your own.',
    /** What a tile says while there is no derivative to draw, keyed by the record's status. */
    waiting: {
      processing: 'Preparing…',
      failed: 'Could not be prepared',
      ready: 'Nothing to show',
    },
    /**
     * Said of the one frame the strip has open — for a screen reader, never on screen. It is read
     * straight after `media.photo` / `media.video`, so the Russian agrees with those two: both are
     * neuter, and «Фото, открыто» is the only form that fits either.
     */
    open: 'open',
    /**
     * The right slot of the glass bar, and it is a switch: pressed once it puts the feed into
     * picking, pressed again it comes back out. Two labels because it is one control saying two
     * different things — «Скачать всю галерею» was the icon here until the kit made taking the lot
     * home the same picking with everything in it (kit, «Экраны» 4, «Выбор»).
     */
    select: 'Select frames',
    leaveSelect: 'Leave select mode',
    /** The left slot of that bar while picking: where `SheetLabels` will be raised from. */
    labelsPut: 'Labels: put the picked frames in one',
    /** The capsule while picking, with nothing marked yet (spec 8, `FramesPicking`). */
    pickNothing: 'Pick some frames',
    /** What pressing that capsule does, said out loud — it is a count on screen and an action here. */
    selectAll: 'Tap to take every frame',
    /** Its second line: what is marked, said the way the layout says it — «3 photos and 1 video». */
    pickedKinds: (photos: number, videos: number) =>
      [
        photos > 0 ? `${photos} ${photos === 1 ? 'photo' : 'photos'}` : null,
        videos > 0 ? `${videos} ${videos === 1 ? 'video' : 'videos'}` : null,
      ]
        .filter(Boolean)
        .join(' and '),
    /**
     * The right edge of a day's own strip while the mode is on, where the count of that day stands
     * the rest of the time — «в строке дня вместо числа „Выбрать все 9“». Word for word what the
     * «Выбор кадров» screen says over its own days, because the kit asks for «тем же тихим
     * действием дня»; kept in this face's section all the same, the way every other word on it is,
     * and the count it carries is this face's own — how many frames of that day can be marked at
     * all, which on a sheet still being developed is not how many there are.
     */
    selectDay: (n: number) => `Select all ${n}`,
    /** The line over that button while the mode is on, where the count of the whole picking stands. */
    picked: (n: number) => `${n} selected`,
    /** The glowing button of the picking mode, carrying what it is about to take home. */
    download: (n: number) => `Download ${n} ${n === 1 ? 'file' : 'files'}`,
    /** The same button with nothing marked yet: off, and saying why rather than «Download 0». */
    nothingPicked: 'Nothing selected',
    addMore: 'Add more',
    /**
     * The same errand from an empty gallery, where there is no «more» to add to yet — and the same
     * road named in full from `SheetTooLittle`, the sheet that stands in for step 1 of an order when
     * the memory has too little in it.
     */
    add: 'Add frames',

    /**
     * `SheetFilter` — what of the gallery is shown. Four groups of its own; the glowing button
     * counts what is about to be shown, so it says outright when that count is nought.
     */
    filters: 'Filters',
    whoBrought: 'Who brought it',
    whatKind: 'Type',
    anyKind: 'All of it',
    /**
     * The heading over the row of boxes (spec 10.8.2). The plural of `labels.title`'s own subject
     * and not a sentence: the chips under it say the rest. This is the only way the contents of a
     * label are looked at — there is no screen of its own for one.
     */
    whichLabels: 'Labels',
    whichDays: 'Day',
    anyDay: 'Every day',
    /** The chip that opens the calendar, for a day the row of days is not offering. */
    otherDay: 'Another date',
    show: (n: number) => `Show ${n} ${n === 1 ? 'frame' : 'frames'}`,
    /** The same button with nothing held back at all: there is no count to promise yet. */
    showAll: 'Show everything',
    nothingMatched: 'No frames under these conditions',
    reset: 'Reset',

    /**
     * `SheetSort` — in what order, and how it is cut. The dates are neither: a date is a caption
     * over a strip and not a group, so it has a switch of its own with a line saying what it does.
     */
    sorting: 'Sorting',
    order: 'Order',
    groupBy: 'Group them',
    /** The three cuts: nothing at all, the person who brought it, photo against video. */
    groups: { none: 'No groups', person: 'By person', kind: 'By kind' },
    orders: { newest: 'Newest first', oldest: 'Oldest first' },
    datesBetween: 'Dates between days',
    datesNote: 'Off — the date is only on the rail at the edge, while you scroll.',
    deleteAsk: (kind: 'photo' | 'video') => `Delete this ${kind === 'video' ? 'video' : 'photo'}?`,
    /** The same question over an armful, with the price named as a number before the press. */
    deleteAskMany: (n: number) => `Delete ${n} ${n === 1 ? 'frame' : 'frames'}?`,
    deleteText: 'It goes from the memory for good. A movie already made keeps it.',
    keep: 'Keep',
    deleteDenied: 'Only the organizer can delete what somebody else brought.',
  },

  /**
   * `Viewer`, `ViewerVideo`, `SheetFrame` and `SheetFrameInfo` — one frame on the whole of the
   * phone, the three things that can be done with it, everything the picture does not say about it,
   * and what a video carries on top of all that.
   */

  /**
   * `Viewer`, `ViewerVideo`, `SheetFrame` and `SheetFrameInfo` — one frame on the whole of the
   * phone, the three things that can be done with it, everything the picture does not say about it,
   * and what a video carries on top of all that.
   */
  viewer: {
    /** The right-hand glass button of the floating bar. It drops the menu of what can be done. */
    more: 'More',
    /** The pill in the middle of that bar, which raises the frame's own sheet. */
    details: 'About this frame',
    saveToPhone: 'Save to your phone',
    remove: 'Delete from the memory',
    /** The line while the file is coming down to be handed on; the failure under it. */
    sharing: 'Getting it ready…',
    shareFailed: 'Could not hand this one on.',
    /** How big the file is, on the frame's own sheet — the number is the phone's own digits. */
    size: (mb: string) => `${mb} MB`,
    play: 'Play',
    pause: 'Pause',
    mute: 'Turn the sound off',
    unmute: 'Turn the sound on',
    /** The scrubber, read out rather than drawn: the timecodes beside it are the visible half. */
    played: 'How much has played',

    /**
     * `SheetFrameInfo` (spec 8) — the four summary lines, who brought it, and which movies it ended
     * up in. A line the server knows nothing about is not drawn at all, so none of these has a word
     * for «unknown»: the absence is the answer.
     */
    brought: (day: string, n: number) => `brought it ${day} · ${n} frames in all`,
    file: 'File',
    /** The frame in pixels, which the layout calls «Размер» — the file's weight is on the line above. */
    pixels: 'Size',
    camera: 'Camera',
    place: 'Place',
    /** The units are words and the api hands over bare numbers, so they are put on here. */
    focal: (mm: number) => `${mm} mm`,
    aperture: (f: number) => `f/${f}`,
    /** The place as numbers: what stands until the phone's geocoder names it, and when it cannot. */
    coords: (lat: number, lon: number) => `${lat}, ${lon}`,
    inFilms: 'In movies',
    /** The second a frame stands at inside a movie, on the row that opens it. */
    at: (runtime: string) => `at ${runtime}`,
    /** Spec 8: a frame whose picture never arrived says so, and the strip stays where it is. */
    notOpened: 'This frame would not open',
  },

  /**
   * `SheetLabels` and `SheetLabelNew` (spec 7.7, 10.8.1) — the boxes frames are filed into, raised
   * from picking mode. A label is a box: it holds nothing back from anybody and takes nothing away,
   * so every word here is about filing and never about permission.
   */

  /**
   * `SheetLabels` and `SheetLabelNew` (spec 7.7, 10.8.1) — the boxes frames are filed into, raised
   * from picking mode. A label is a box: it holds nothing back from anybody and takes nothing away,
   * so every word here is about filing and never about permission.
   */
  labels: {
    /** The sheet's own heading, over the count of what is marked. */
    title: 'Into a label',
    /** Its two groups, in the caps the layout writes a group heading in. */
    shared: 'Shared',
    own: 'Mine',
    /** The dashed button under both of them, and the heading of the sheet it raises. */
    newOne: 'New label',
    /** The whole sheet when there is not a label in the memory yet — the two groups are gone. */
    empty: 'A label is a box: give it a name and start filing frames into it.',
    /** The second line of a row: what the glyph beside it already says, in words. */
    seenByAll: 'everyone sees it',
    seenByYou: 'only you',
    /** The way in and out of the edit mode of the sheet — «Готово» is `action.done`. */
    edit: 'Edit',
    /** The pair that replaces the circle while it is on, read out with the label's own name. */
    rename: (name: string) => `Rename “${name}”`,
    remove: (name: string) => `Delete “${name}”`,

    /** `SheetLabelNew`: the heading when the same sheet is editing one rather than making it. */
    editTitle: 'Label',
    name: 'Name',
    namePlaceholder: 'Best ones',
    colour: 'Colour',
    /** The row of eight said out loud — «Colour 2» tells nobody anything (spec 10.4). */
    colourLabel: 'Label colour',
    colours: ['yellow', 'pink', 'red', 'green', 'blue', 'violet', 'acid', 'grey'],
    who: 'Who sees it',
    sharedCard: 'Shared',
    sharedNote: 'everyone in the memory',
    ownCard: 'Private',
    ownNote: 'only you',
    /**
     * Why «Кто видит» cannot be pressed while editing (spec 10.8.1): visibility is chosen once, when
     * the label is made, and changing it afterwards is not allowed (decision-12). Said as a fact,
     * not as a refusal.
     */
    whoFixed: 'Settled when the label was made.',
    /** The glowing button: one press makes the box and files what is marked into it. */
    create: (n: number) => `Create and file ${n} ${n === 1 ? 'frame' : 'frames'}`,
    save: 'Save',

    /** The sheet that asks before a box goes. No number: nothing is lost (spec 10.8.1). */
    deleteAsk: (name: string) => `Delete the label “${name}”?`,
    deleteText: 'The frames stay in the memory — only the box goes.',
    deleteConfirm: 'Delete the label',

    /**
     * The one refusal the labels still have — a viewer making a shared one — in words a person can
     * act on. The api answers a bare «forbidden», so the sentence is written here.
     */
    sharedDenied:
      'Only people who can add photos may make a shared label. You can make a private one.',
    gone: 'This label is no longer here.',
  },

  /**
   * The assembled videos of one memory, and the ordering of one more.
   *
   * English calls the finished thing a **movie**, never a «video» or a «montage» — the api's push
   * settled that word (TASK-88) and the app must not call one thing two things: «video» is already
   * taken by what people upload («Photos and videos», `media.video`). The Russian «ролик» carries
   * that separation on its own, which is why only the English side needed deciding.
   */
};

export const ru: typeof en = {
  gallery: {
    emptyTitle: 'Ни одного кадра',
    empty: 'Всё, что добавит любой участник, появится здесь. Начните со своих.',
    waiting: {
      processing: 'Проявляем…',
      failed: 'Не удалось проявить',
      ready: 'Показывать нечего',
    },
    open: 'открыто',
    select: 'Выбрать кадры',
    leaveSelect: 'Выйти из режима выбора',
    labelsPut: 'Лейблы: положить выбранное',
    pickNothing: 'Выберите кадры',
    selectAll: 'Нажмите, чтобы выбрать все',
    // Фото и видео по-русски не склоняются, поэтому считается только само число.
    pickedKinds: (photos: number, videos: number) =>
      [photos > 0 ? `${photos} фото` : null, videos > 0 ? `${videos} видео` : null]
        .filter(Boolean)
        .join(' и '),
    selectDay: (n: number) => `Выбрать все ${n}`,
    picked: (n: number) => `Выбрано ${n}`,
    download: (n: number) => `Скачать ${count(n, 'файл', 'файла', 'файлов')}`,
    nothingPicked: 'Ничего не выбрано',
    addMore: 'Добавить ещё',
    add: 'Добавить кадры',

    filters: 'Фильтры',
    whoBrought: 'Кто принёс',
    whatKind: 'Тип',
    anyKind: 'Всё',
    whichLabels: 'Лейблы',
    whichDays: 'День',
    anyDay: 'Все дни',
    otherDay: 'Другая дата',
    show: (n: number) => `Показать ${count(n, 'кадр', 'кадра', 'кадров')}`,
    showAll: 'Показать все',
    nothingMatched: 'Ни одного кадра под эти условия',
    reset: 'Сбросить',

    sorting: 'Сортировка',
    order: 'Порядок',
    groupBy: 'Собрать в группы',
    groups: { none: 'Не собирать', person: 'По людям', kind: 'По типу' },
    orders: { newest: 'Сначала новые', oldest: 'Сначала старые' },
    datesBetween: 'Даты между днями',
    datesNote: 'Выключено — дата видна только на полосе у края, пока листаете.',
    deleteAsk: (kind: 'photo' | 'video') => `Удалить это ${kind === 'video' ? 'видео' : 'фото'}?`,
    deleteAskMany: (n: number) => `Удалить ${count(n, 'кадр', 'кадра', 'кадров')}?`,
    deleteText: 'Оно уйдёт из воспоминания навсегда. В уже собранном ролике останется.',
    keep: 'Оставить',
    deleteDenied: 'Удалять чужое может только организатор.',
  },

  viewer: {
    more: 'Ещё',
    details: 'Сведения о кадре',
    saveToPhone: 'Сохранить на телефон',
    remove: 'Удалить из воспоминания',
    sharing: 'Готовим к отправке…',
    shareFailed: 'Не получилось поделиться этим кадром.',
    size: (mb: string) => `${mb} МБ`,
    play: 'Играть',
    pause: 'Пауза',
    mute: 'Выключить звук',
    unmute: 'Включить звук',
    played: 'Сколько проиграно',

    brought: (day: string, n: number) =>
      `принёс ${day} · всего ${count(n, 'кадр', 'кадра', 'кадров')}`,
    file: 'Файл',
    pixels: 'Размер',
    camera: 'Камера',
    place: 'Место',
    focal: (mm: number) => `${mm} мм`,
    aperture: (f: number) => `f/${f}`,
    coords: (lat: number, lon: number) => `${lat}, ${lon}`,
    inFilms: 'В роликах',
    at: (runtime: string) => `на ${runtime}`,
    notOpened: 'Кадр не открылся',
  },

  labels: {
    title: 'В лейбл',
    shared: 'Общие',
    own: 'Мои',
    newOne: 'Новый лейбл',
    empty: 'Лейбл — это коробка: назовите её и складывайте кадры.',
    seenByAll: 'видят все',
    seenByYou: 'только вы',
    edit: 'Править',
    rename: (name: string) => `Переименовать «${name}»`,
    remove: (name: string) => `Удалить «${name}»`,

    editTitle: 'Лейбл',
    name: 'Название',
    namePlaceholder: 'Лучшее',
    colour: 'Цвет',
    colourLabel: 'Цвет лейбла',
    colours: [
      'жёлтый',
      'розовый',
      'красный',
      'зелёный',
      'голубой',
      'фиолетовый',
      'кислотный',
      'серый',
    ],
    who: 'Кто видит',
    sharedCard: 'Общий',
    sharedNote: 'видят все участники',
    ownCard: 'Личный',
    ownNote: 'только вы',
    whoFixed: 'Выбирается один раз, при создании.',
    create: (n: number) => `Создать и положить ${count(n, 'кадр', 'кадра', 'кадров')}`,
    save: 'Сохранить',

    deleteAsk: (name: string) => `Удалить лейбл «${name}»?`,
    deleteText: 'Кадры останутся в воспоминании — исчезнет только коробка.',
    deleteConfirm: 'Удалить лейбл',

    sharedDenied: 'Общий лейбл могут завести те, кто добавляет фото. Вы можете завести личный.',
    gone: 'Этого лейбла больше нет.',
  },
};
