/**
 * Everything the app says, in the two languages it speaks (doc-8). One key, two sets, both written
 * by hand: the English is not a translation of the Russian and the Russian is not a translation of
 * the English — each is written the way that language says the thing. The kit's vocabulary is the
 * law on the Russian side: воспоминание, кадры, участники, ролик, and one word per action.
 *
 * `en` fixes the shape and `ru` has to fill it, so a key that gains a set and not the other stops
 * the typecheck rather than showing an English word inside a Russian screen.
 *
 * Everything the app puts in front of a person is here: the words that repeat everywhere first, then
 * one group per screen in the order the app is walked. What is *not* here is anything a person wrote
 * — a memory's title, a username, a filename — and the api's own wording for a failure, which comes
 * back down the wire already in a language (TASK-91 is what tells it which).
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
    signingIn: 'Signing you in…',
    joining: 'Joining…',
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

  /** What one record is, said out loud — the tile's own name for a screen reader. */
  media: { photo: 'Photo', video: 'Video' },

  /**
   * Putting a file on the phone, said the same by both screens that do it (`@/downloads`): the
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
  role: { organizer: 'Organizer', contributor: 'Contributor', viewer: 'Viewer' },

  /**
   * The four standings of doc-06 — «прогресс у организатора», keyed by the api's own values.
   * Short on purpose: these share one meta line with «@username», and a sentence there wraps the
   * member row onto a height the kit never drew.
   */
  standing: {
    not_started: 'Nothing yet',
    more_coming: 'Still adding',
    done: 'All uploaded',
    nothing: 'Nothing to add',
  },

  /** The main screen: every memory this account organizes or was invited to. */
  home: {
    title: 'Memories',
    about: 'About',
    profile: 'Profile',
    empty:
      'No memories yet. Start one for your next event and the photos will land here from everyone.',
    /** A memory with nothing in it at all — said on the film of its own card. */
    noFrames: 'No frames yet. Add the first ones.',
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
  login: {
    withApple: 'Continue with Apple',
    withGoogle: 'Continue with Google',
    appleUnavailable: 'Apple sign-in is not available on this device.',
    providerUnavailable: (provider: string) => `${provider} sign-in isn't available yet.`,
    noIdentityToken: (provider: string) => `${provider} did not return an identity token.`,
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    sendLink: 'Send me a link',
    /**
     * 503 is the api saying it has no mail keys. Its own wording for that is written for whoever
     * runs it, so the screen answers in its own words rather than passing the server's along.
     */
    mailDown: "We can't send sign-in links right now — try again later.",
    sentTitle: 'Check your link',
    sentText: (email: string) => `Open the link we sent to ${email} — it signs you in here.`,
    otherAddress: 'Use a different address',
  },

  /** Where a sign-in link lands. */
  link: {
    noToken: 'This link has no token in it — request a new one.',
    expired: 'This link expired — request a new one.',
    backToSignIn: 'Back to sign in',
  },

  /** Where an invite link lands. */
  join: {
    noToken: 'This link has no token in it — ask for a new one.',
    dead: 'This invite link is no longer valid — ask whoever sent it for a new one.',
    home: 'Go to my memories',
  },

  /** Starting a memory: a title and the day (or span) the event happened on. */
  create: {
    title: 'New memory',
    titleLabel: 'Title',
    titlePlaceholder: 'Anna’s birthday',
    eventDate: 'Event date',
    multiDay: 'Lasted more than a day',
    ends: 'Ends',
    submit: 'Create',
  },

  /** The guest list: who is in a memory, how to get more people in, and how to get out. */
  members: {
    /** The corner icon the gallery and the montage screen reach the roster by. */
    title: 'Members',
    /** The appbar before the memory itself has arrived — its own title takes over then. */
    fallbackTitle: 'Memory',
    material: (n: number) => `Photos and videos (${n})`,
    /** The same button before the count is known. */
    materialPlain: 'Photos and videos',
    roster: 'Who is here',
    you: (name: string) => `${name} (you)`,
    remove: (name: string) => `Remove ${name}`,
    /**
     * doc-06's «ждать нечего», given unprompted on one's own row. Said in the first person so it
     * reads as the thing one presses, and not as the standing of the same name printed above it.
     */
    sayNothing: 'I have nothing to add',
    leave: 'Leave this memory',
    inviteTitle: 'Invite someone',
    mayAdd: 'They can add photos too',
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
    leaveAsk: 'Leave this memory?',
    leaveText: 'Everything you uploaded here goes with you. There is no getting it back.',
    leaveDo: 'Leave',
    stay: 'Stay',
    removeAsk: (name: string) => `Remove ${name}?`,
    removeText: 'Everything they uploaded here goes with them. There is no getting it back.',
    removeDo: 'Remove',
    keepThem: 'Keep them',
  },

  /** The contact sheet, and the open frame over it. */
  gallery: {
    title: 'Gallery',
    empty: 'Nothing here yet — whatever anyone adds shows up here.',
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
    downloadAll: 'Download all',
    addMore: 'Add more',
    deleteAsk: (kind: 'photo' | 'video') => `Delete this ${kind === 'video' ? 'video' : 'photo'}?`,
    deleteText: 'It goes from the memory for good. A movie already made keeps it.',
    keep: 'Keep',
    deleteDenied: 'Only the organizer can delete what somebody else brought.',
  },

  /**
   * The assembled videos of one memory, and the ordering of one more.
   *
   * English calls the finished thing a **movie**, never a «video» or a «montage» — the api's push
   * settled that word (TASK-88) and the app must not call one thing two things: «video» is already
   * taken by what people upload («Photos and videos», `media.video`). The Russian «ролик» carries
   * that separation on its own, which is why only the English side needed deciding.
   */
  montage: {
    /** The corner icon the guest list reaches the movies by, and their screen's own title. */
    title: 'Movie',
    status: {
      queued: 'Waiting its turn',
      processing: 'Being made',
      ready: 'Ready',
      failed: 'Did not finish',
    },
    /** The worker's three tracks, under names to pick between. The ids are the api's own. */
    track: { warm: 'Warm', bright: 'Bright', calm: 'Calm' },
    /** Three round answers out of the range the api takes, keyed by the seconds asked for. */
    length: { 30: 'Half a minute', 60: 'A minute', 120: 'Two minutes' },
    ofLength: (runtime: string) => `Movie of ${runtime}`,
    fromDay: (day: string) => `Movie from ${day}`,
    caption: 'You will be told when it is ready',
    watch: (title: string) => `Watch ${title}`,
    saveShare: 'Save and share',
    make: 'Make a movie',
    makeIt: 'Make it',
    explain:
      'Everything in this memory goes in, and the agent picks the moments itself. What comes out is not edited afterwards.',
    howLong: 'How long',
    music: 'Music',
    empty: 'No movie yet — the organizer can ask for one.',
    ordered: 'Ordered. Everyone here is told when it is ready.',
    tooLittle: 'Too little material for a movie yet — add a few more photos or videos first.',
    orderDenied: 'Only the organizer can order a movie.',
    movedOn: 'That one has already moved on — reading the list again.',
    retryDenied: 'Only the organizer can start it again.',
    /** The line the share sheet goes out with. The memory's own title is not translated. */
    shareText: (title: string) => `Movie from «${title}»`,
  },

  /** Picking material off the phone, and the queue that sends it (`@/uploads`). */
  upload: {
    title: 'Upload',
    explain:
      'Remember cannot see a thing in your gallery until you say so — and what you pick stays on this phone until you send it.',
    refused:
      'The phone only asks once, and the answer was no. Turning it back on is in Settings, under Remember.',
    allow: 'Allow access',
    limited:
      'Only the photos you handed to Remember are here — the rest of the gallery is invisible to this screen, «select all from that date» included.',
    chooseMore: 'Choose more',
    cannotRead: 'Cannot read the gallery on this phone.',
    selectEvent: 'Select all from that date',
    nothingThen: 'Nothing in the gallery was shot on those days.',
    reading: 'Still reading the gallery…',
    emptyGallery: 'Nothing to pick — this phone’s gallery is empty.',
    stillToSend: (n: number) => `${n} still to send`,
    carriesOn: 'The app can be put away — sending carries on.',
    dropFile: (name: string) => `Drop ${name} from the queue`,
    picked: (n: number) => `${n} selected`,
    pickedOf: (n: number, total: number) => `${n} selected of ${total}`,
    clear: 'Clear',
    /** What the queue parks a file with. The filename is the phone's own and stays as it is. */
    gone: (name: string) => `${name} is no longer on this phone.`,
    partRefused: (part: number, status: number) => `Storage refused part ${part} (${status}).`,
    noReceipt: (part: number) => `Storage took part ${part} without a receipt.`,
    noLink: (part: number) => `The api signed no link for part ${part}.`,
    partSizeChanged: 'The part size changed.',
    partNotTaken: (part: number) => `Storage would not take part ${part}.`,
    /** doc-06, asked once by the system dialog on the first file that lands in a memory. */
    askAll: 'Is that everything?',
    askAllText: 'Or is there more still to come?',
    moreToCome: 'More to come',
    thatsAll: 'That’s all',
  },

  /** The account: who you are here, and the way out. */
  profile: {
    title: 'Profile',
    /** Stands where the name would be. An invitation to give one, never a report that there is none. */
    noName: 'Add your name',
    changeUsername: 'Change username',
    logOutAsk: 'Log out?',
    logOutText:
      'The session on this phone ends. You will have to sign in again to get back to your memories.',
    stay: 'Stay signed in',
  },

  /** The one username field, shared by the first claim and the change. */
  username: {
    label: 'Username',
    placeholder: 'username',
    free: 'Username is free.',
    pick: 'Pick a username',
    lead: 'This is how other people find you in a memory.',
    continue: 'Continue',
  },

  /**
   * The two languages name themselves. A person looking for their own language reads it in that
   * language, so these two lines are the same in both sets on purpose.
   */
  language: { label: 'Language', ru: 'Русский', en: 'English' },

  /** doc-9. The third one is not a light but the phone going on deciding. */
  theme: { label: 'Theme', system: 'As on phone', dark: 'Dark', light: 'Light' },
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
    signingIn: 'Впускаем…',
    joining: 'Присоединяем…',
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
    not_started: 'Пока ничего',
    more_coming: 'Ещё добавляет',
    done: 'Загрузил всё',
    nothing: 'Ждать нечего',
  },

  home: {
    title: 'Воспоминания',
    about: 'О приложении',
    profile: 'Профиль',
    empty:
      'Воспоминаний пока нет. Заведите одно к ближайшему событию — и снимки начнут стекаться сюда от всех.',
    noFrames: 'Кадров пока нет. Добавьте первые.',
    create: 'Новое воспоминание',
  },

  about: {
    lead: 'Мобильный клиент.',
    apiUrl: 'Адрес сервера',
    hint: 'Чтобы указать другой сервер, задайте EXPO_PUBLIC_API_URL.',
    back: 'На главную',
  },

  login: {
    withApple: 'Войти через Apple',
    withGoogle: 'Войти через Google',
    appleUnavailable: 'На этом устройстве вход через Apple недоступен.',
    providerUnavailable: (provider: string) => `Вход через ${provider} пока не работает.`,
    noIdentityToken: (provider: string) => `${provider} не вернул токен входа.`,
    email: 'Почта',
    emailPlaceholder: 'ivan@example.com',
    sendLink: 'Пришлите ссылку',
    mailDown: 'Сейчас мы не можем отправлять ссылки для входа — попробуйте позже.',
    sentTitle: 'Ссылка отправлена',
    sentText: (email: string) =>
      `Откройте ссылку, которую мы прислали на ${email}, — она впустит вас сюда.`,
    otherAddress: 'Другой адрес',
  },

  link: {
    noToken: 'В этой ссылке нет ключа — запросите новую.',
    expired: 'Ссылка больше не действует — запросите новую.',
    backToSignIn: 'К входу',
  },

  join: {
    noToken: 'В этой ссылке нет ключа — попросите новую.',
    dead: 'Это приглашение больше не действует — попросите новое у того, кто его прислал.',
    home: 'К моим воспоминаниям',
  },

  create: {
    title: 'Новое воспоминание',
    titleLabel: 'Название',
    titlePlaceholder: 'День рождения Анны',
    eventDate: 'Дата события',
    multiDay: 'Длилось больше дня',
    ends: 'Заканчивается',
    submit: 'Создать',
  },

  members: {
    title: 'Участники',
    fallbackTitle: 'Воспоминание',
    material: (n: number) => `Фото и видео (${n})`,
    materialPlain: 'Фото и видео',
    roster: 'Кто здесь',
    you: (name: string) => `${name} (вы)`,
    remove: (name: string) => `Убрать ${name}`,
    sayNothing: 'Мне нечего добавить',
    leave: 'Выйти из воспоминания',
    inviteTitle: 'Позвать человека',
    mayAdd: 'Сможет добавлять фото',
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
    leaveAsk: 'Выйти из воспоминания?',
    leaveText: 'Всё, что вы сюда загрузили, уйдёт вместе с вами. Вернуть это не получится.',
    leaveDo: 'Выйти',
    stay: 'Остаться',
    removeAsk: (name: string) => `Убрать ${name}?`,
    removeText:
      'Всё, что этот человек сюда загрузил, уйдёт вместе с ним. Вернуть это не получится.',
    removeDo: 'Убрать',
    keepThem: 'Оставить',
  },

  gallery: {
    title: 'Галерея',
    empty: 'Здесь пока пусто — всё, что кто-нибудь добавит, появится тут.',
    waiting: {
      processing: 'Проявляем…',
      failed: 'Не удалось проявить',
      ready: 'Показывать нечего',
    },
    open: 'открыто',
    downloadAll: 'Скачать всё',
    addMore: 'Добавить ещё',
    deleteAsk: (kind: 'photo' | 'video') => `Удалить это ${kind === 'video' ? 'видео' : 'фото'}?`,
    deleteText: 'Оно уйдёт из воспоминания навсегда. В уже собранном ролике останется.',
    keep: 'Оставить',
    deleteDenied: 'Удалять чужое может только организатор.',
  },

  montage: {
    title: 'Ролик',
    status: {
      queued: 'Ждёт очереди',
      processing: 'Собирается',
      ready: 'Готов',
      failed: 'Не собрался',
    },
    track: { warm: 'Тёплая', bright: 'Яркая', calm: 'Спокойная' },
    length: { 30: 'Полминуты', 60: 'Минута', 120: 'Две минуты' },
    ofLength: (runtime: string) => `Ролик на ${runtime}`,
    fromDay: (day: string) => `Ролик от ${day}`,
    caption: 'Мы сообщим, когда будет готов',
    watch: (title: string) => `Смотреть: ${title}`,
    saveShare: 'Сохранить и поделиться',
    make: 'Смонтировать ролик',
    makeIt: 'Смонтировать',
    explain:
      'В ролик пойдёт всё из этого воспоминания, а моменты нейросеть выберет сама. Готовый ролик не редактируется.',
    howLong: 'Длина',
    music: 'Музыка',
    empty: 'Роликов пока нет — организатор может заказать.',
    ordered: 'Заказали. Когда ролик будет готов, все здесь об этом узнают.',
    tooLittle: 'Материала для ролика пока мало — добавьте ещё несколько фото или видео.',
    orderDenied: 'Заказать ролик может только организатор.',
    movedOn: 'С этим уже что-то произошло — перечитываем список.',
    retryDenied: 'Запустить заново может только организатор.',
    shareText: (title: string) => `Ролик из «${title}»`,
  },

  upload: {
    title: 'Загрузка',
    explain:
      'Remember не видит вашу галерею, пока вы не разрешите, — а выбранное остаётся на телефоне, пока вы не отправите его.',
    refused:
      'Телефон спрашивает один раз, и ответ был «нет». Включить обратно можно в настройках, в разделе Remember.',
    allow: 'Разрешить доступ',
    limited:
      'Здесь только те снимки, что вы отдали Remember, — остальная галерея этому экрану не видна, «Выбрать всё за эти даты» тоже.',
    chooseMore: 'Отдать ещё',
    cannotRead: 'Не получилось прочитать галерею на этом телефоне.',
    selectEvent: 'Выбрать всё за эти даты',
    nothingThen: 'В галерее нет ничего, снятого в эти дни.',
    reading: 'Ещё читаем галерею…',
    emptyGallery: 'Выбирать нечего — галерея этого телефона пуста.',
    stillToSend: (n: number) => `Осталось ${count(n, 'файл', 'файла', 'файлов')}`,
    carriesOn: 'Приложение можно свернуть — отправка продолжится.',
    dropFile: (name: string) => `Убрать ${name} из очереди`,
    picked: (n: number) => `Выбрано ${n}`,
    pickedOf: (n: number, total: number) => `Выбрано ${n} из ${total}`,
    clear: 'Снять выбор',
    gone: (name: string) => `${name} больше нет на этом телефоне.`,
    partRefused: (part: number, status: number) =>
      `Хранилище отказало на части ${part} (${status}).`,
    noReceipt: (part: number) => `Хранилище приняло часть ${part} без квитанции.`,
    noLink: (part: number) => `Сервер не подписал ссылку для части ${part}.`,
    partSizeChanged: 'Размер части изменился.',
    partNotTaken: (part: number) => `Хранилище не приняло часть ${part}.`,
    askAll: 'Это всё?',
    askAllText: 'Или что-то ещё осталось?',
    moreToCome: 'Ещё будет',
    thatsAll: 'Больше ничего',
  },

  profile: {
    title: 'Профиль',
    noName: 'Добавьте имя',
    changeUsername: 'Сменить ник',
    logOutAsk: 'Выйти?',
    logOutText:
      'Сеанс на этом телефоне закончится. Чтобы вернуться к своим воспоминаниям, придётся войти снова.',
    stay: 'Остаться',
  },

  username: {
    label: 'Ник',
    placeholder: 'ник',
    free: 'Ник свободен.',
    pick: 'Придумайте ник',
    lead: 'По нему вас найдут в воспоминании.',
    continue: 'Продолжить',
  },

  language: { label: 'Язык', ru: 'Русский', en: 'English' },

  theme: { label: 'Тема', system: 'Как в телефоне', dark: 'Тёмная', light: 'Светлая' },
};

/** Both sets, by the language they belong to. */
export const strings = { en, ru };
