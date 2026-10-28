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
    /**
     * The glowing button of the picking mode, carrying how many it is about to take home — the
     * number alone, as `FramesPicking` writes it («Скачать 4», spec 9).
     */
    download: (n: number) => `Download ${n}`,
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
     * The density of the feed, said by the pill that stands in the glass bar while a pinch is
     * walking it (spec 10.14.1). These are the account's own words, moved here with the setting:
     * `framesPerRow` reads the pill out — «Frames per row: 5» — and `framesPerRowWords` is the
     * line drawn under the number. At the last step of the scale the caption and the reading are
     * both `onePerRow`.
     */
    framesPerRow: (n: number) => `Frames per row: ${n}`,
    framesPerRowWords: 'frames per row',
    onePerRow: 'one per row',

    /**
     * `SheetFilter` — what of the gallery is shown. Five sections of its own; the glowing button
     * counts what is about to be shown, so it says outright when that count is nought.
     */
    filters: 'Filters',
    /** In the head of every section: lit while the section holds nothing back. */
    all: 'All',
    /** The same «All» read out with its section, since five of them in a row are otherwise one word. */
    allOf: (section: string) => `All: ${section}`,
    whoBrought: 'Who brought it',
    whatKind: 'Type',
    /** The words of «Формат» on `MontageBuild` — the same axis (spec 7.3, detail 18). */
    whichOrientation: 'Orientation',
    orientations: { landscape: 'Wide', portrait: 'Tall' },
    /**
     * The heading over the row of boxes (spec 10.8.2). The plural of `labels.title`'s own subject
     * and not a sentence: the chips under it say the rest. This is the only way the contents of a
     * label are looked at — there is no screen of its own for one.
     */
    whichLabels: 'Labels',
    whichDays: 'Day',
    /** The round calendar button beside the day section's «All», for a day the tiles are not offering. */
    otherDay: 'Pick another date',
    /** A day tile read out whole: «13 September, Sat, 312 frames». */
    dayTile: (day: string, weekday: string, frames: string) => `${day}, ${weekday}, ${frames}`,
    show: (n: number) => `Show ${n} ${n === 1 ? 'frame' : 'frames'}`,
    /** The same button with nothing held back at all: there is no count to promise yet. */
    showAll: 'Show everything',
    nothingMatched: 'No frames under these conditions',
    reset: 'Reset',

    /**
     * `SheetSort` — in what order, and how it is cut. The dates are neither: whether they stand
     * between the days is the account's setting, not the sheet's.
     */
    sorting: 'Sorting',
    order: 'Order',
    groupBy: 'Group them',
    /** The three cuts: nothing at all, the person who brought it, photo against video. */
    groups: { none: 'No groups', person: 'By person', kind: 'By kind' },
    orders: { newest: 'Newest first', oldest: 'Oldest first' },
    deleteAsk: (kind: 'photo' | 'video') => `Delete this ${kind === 'video' ? 'video' : 'photo'}?`,
    /** The same question over an armful, with the price named as a number before the press. */
    deleteAskMany: (n: number) => `Delete ${n} ${n === 1 ? 'frame' : 'frames'}?`,
    deleteText: 'It goes from the memory for good. A movie already made keeps it.',
    keep: 'Keep',
    deleteDenied: 'Only the organizer can delete what somebody else brought.',
  },

  /**
   * `Viewer`, `ViewerVideo`, `SheetFrame` and `FrameInfo` — one frame on the whole of the
   * phone, the three things that can be done with it, everything the picture does not say about it,
   * and what a video carries on top of all that.
   */
  viewer: {
    /** The right-hand glass button of the floating bar. It drops the menu of what can be done. */
    more: 'More',
    /** The pill in the middle of that bar, which brings up the frame's own screen under the picture. */
    details: 'About this frame',
    /**
     * The same pill while the frame's own screen stands under it (spec 8, `FrameInfo`): the panel
     * came up under this button and the same button takes it back down.
     */
    hideDetails: 'Hide the details',
    saveToPhone: 'Save to your phone',
    remove: 'Delete from the memory',
    /** The line while the file is coming down to be handed on; the failure under it. */
    sharing: 'Getting it ready…',
    shareFailed: 'Could not hand this one on.',
    /** How big the file is, on the frame's own screen — the number is the phone's own digits. */
    size: (mb: string) => `${mb} MB`,
    play: 'Play',
    pause: 'Pause',
    mute: 'Turn the sound off',
    unmute: 'Turn the sound on',
    /** The scrubber, read out rather than drawn: the timecodes beside it are the visible half. */
    played: 'How much has played',

    /**
     * `FrameInfo` (spec 8) — the four summary lines, who brought it, and which movies it ended
     * up in. A line the server knows nothing about is not drawn at all, so none of these has a word
     * for «unknown»: the absence is the answer.
     */
    brought: (day: string, n: number) => `brought it ${day} · ${n} frames in all`,
    file: 'File',
    /** The tail of the shot row — the words that change when the frame was shot (`FrameInfo.html` e61). */
    editShot: 'Change',
    /** The frame in pixels, which the layout calls «Размер» — the file's weight is on the line above. */
    pixels: 'Size',
    camera: 'Camera',
    place: 'Place',
    /** The units are words and the api hands over bare numbers, so they are put on here. */
    focal: (mm: number) => `${mm} mm`,
    aperture: (f: number) => `f/${f}`,
    /** The first cell of the shooting settings strip: a number and a word the camera also uses. */
    iso: (n: number) => `ISO ${n}`,
    /** The middle one. Signed, and a bare `0` stands — a camera that metered without compensation. */
    ev: (n: number) => `${n} ev`,
    /**
     * The last one: the fraction the EXIF holds with the unit a reader's language spells it in —
     * `1/60 s`. The denominator is the answer, so the api sends the fraction and never seconds.
     */
    shutter: (fraction: string) => `${fraction} s`,
    /** The place as numbers: what stands until the phone's geocoder names it, and when it cannot. */
    coords: (lat: number, lon: number) => `${lat}, ${lon}`,
    inFilms: 'In movies',
    /** The second a frame stands at inside a movie, on the row that opens it. */
    at: (runtime: string) => `at ${runtime}`,
    /**
     * `FrameInfo` (spec 8, `FrameInfo.html` lines 33–49) — what people wrote under the frame.
     * A frame nobody has written about says so in words under a counter of zero, because the
     * block is on the sheet and an empty box with no line in it is not an answer.
     */
    comments: 'Comments',
    /** Under a counter of zero — not an error and not a spinner, and not the block's absence. */
    commentsNone: 'Nobody has written yet',
    /** The pill: what is typed under a frame. */
    commentPlaceholder: 'Write about this frame…',
    /**
     * Over a comment of their own, where somebody else's stands. The row is otherwise the same
     * one, and naming the writer is the only difference the design draws.
     */
    commentMine: 'you',
    /** The sign at the right of their own comment — the same three dots the frame's bar drops. */
    commentRemove: 'Delete this comment',
    /** And the sheet it drops, which names the cost before the press as every confirmation does. */
    commentDeleteAsk: 'Delete this comment?',
    commentDeleteText: 'It goes for good — from the frame, and from what the director reads.',
    /**
     * Under the pill whose words did not go, and in the delete sheet — repeat the press and they
     * go. What it says and no more: the phone cannot tell a dead connection from a comment over the
     * ceiling, and a line naming either sends the person looking for a signal that is not the
     * reason. The api's own words stand in this one's place whenever it sent any.
     */
    commentNotSent: 'Not sent',
    /** The same quiet admission where it was a deletion that did not happen. */
    commentNotRemoved: 'Not deleted',
    /** `formatAgo` (m-32): the two days back that are named rather than dated. */
    agoYesterday: 'yesterday',
    agoBeforeYesterday: 'the day before yesterday',
    /** Spec 8: a frame whose picture never arrived says so, and the strip stays where it is. */
    notOpened: 'This frame would not open',
    /** The tap on the picture itself (TASK-476) — the two words a reader is given, one per state. */
    hideTools: 'Hide the tools',
    showTools: 'Show the tools',
  },

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

    /**
     * `FrameInfo` (spec 10.8.2, detail 18) — the two ways into a box from the frame's own screen:
     * the chip under a box the frame already lies in takes it back out, and `putInto` is the dashed
     * one that opens this sheet for a box it does not lie in yet.
     */
    takeOut: (name: string) => `Take the frame out of “${name}”`,
    putInto: 'Put it into a label',

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
    download: (n: number) => `Скачать ${n}`,
    nothingPicked: 'Ничего не выбрано',
    addMore: 'Добавить ещё',
    add: 'Добавить кадры',

    // Слова аккаунта, переехавшие вместе с настройкой: подпись под числом и то, как пилюля
    // читается вслух. На последнем шаге шкалы и то и другое — «по одному кадру».
    framesPerRow: (n: number) => `Кадров в ряду: ${n}`,
    framesPerRowWords: 'кадров в ряду',
    onePerRow: 'по одному кадру',

    filters: 'Фильтры',
    all: 'Все',
    allOf: (section: string) => `Все: ${section}`,
    whoBrought: 'Кто принёс',
    whatKind: 'Тип',
    whichOrientation: 'Ориентация',
    orientations: { landscape: 'Горизонтальные', portrait: 'Вертикальные' },
    whichLabels: 'Лейблы',
    whichDays: 'День',
    otherDay: 'Выбрать другую дату',
    dayTile: (day: string, weekday: string, frames: string) => `${day}, ${weekday}, ${frames}`,
    show: (n: number) => `Показать ${count(n, 'кадр', 'кадра', 'кадров')}`,
    showAll: 'Показать все',
    nothingMatched: 'Ни одного кадра под эти условия',
    reset: 'Сбросить',

    sorting: 'Сортировка',
    order: 'Порядок',
    groupBy: 'Собрать в группы',
    groups: { none: 'Не собирать', person: 'По людям', kind: 'По типу' },
    orders: { newest: 'Сначала новые', oldest: 'Сначала старые' },
    deleteAsk: (kind: 'photo' | 'video') => `Удалить это ${kind === 'video' ? 'видео' : 'фото'}?`,
    deleteAskMany: (n: number) => `Удалить ${count(n, 'кадр', 'кадра', 'кадров')}?`,
    deleteText: 'Оно уйдёт из воспоминания навсегда. В уже собранном ролике останется.',
    keep: 'Оставить',
    deleteDenied: 'Удалять чужое может только организатор.',
  },

  viewer: {
    more: 'Ещё',
    details: 'Сведения о кадре',
    hideDetails: 'Скрыть сведения',
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
    editShot: 'Изменить',
    pixels: 'Размер',
    camera: 'Камера',
    place: 'Место',
    focal: (mm: number) => `${mm} мм`,
    aperture: (f: number) => `f/${f}`,
    /** Первая ячейка полосы настроек съёмки: число и слово, каким оно и в камере. */
    iso: (n: number) => `ISO ${n}`,
    /** Средняя. Знаковая, и голый `0` стоит — камера, мерившая без коррекции. */
    ev: (n: number) => `${n} ev`,
    /**
     * Последняя: дробь, какой её держит EXIF, и единица, которой её пишет язык читающего —
     * «1/60 с». Знаменатель и есть ответ, поэтому api шлёт дробь, а не секунды.
     */
    shutter: (fraction: string) => `${fraction} с`,
    coords: (lat: number, lon: number) => `${lat}, ${lon}`,
    inFilms: 'В роликах',
    at: (runtime: string) => `на ${runtime}`,
    comments: 'Комментарии',
    commentsNone: 'Пока никто не написал',
    commentPlaceholder: 'Написать про этот кадр…',
    commentMine: 'вы',
    commentRemove: 'Удалить комментарий',
    commentDeleteAsk: 'Удалить комментарий?',
    commentDeleteText: 'Он исчезнет навсегда — с кадра и из того, что читает режиссёр.',
    commentNotSent: 'Не отправилось',
    commentNotRemoved: 'Не удалилось',
    agoYesterday: 'вчера',
    agoBeforeYesterday: 'позавчера',
    notOpened: 'Кадр не открылся',
    hideTools: 'Спрятать панели',
    showTools: 'Показать панели',
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
    takeOut: (name: string) => `Убрать кадр из «${name}»`,
    putInto: 'Положить в лейбл',

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
