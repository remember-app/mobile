import { count, form } from './plural';

/**
 * The words of every screen a movie has — the order by steps, the stages of the cut as the director
 * reports them, and the finished movie.
 */
export const en = {
  /**
   * The assembled videos of one memory, and the ordering of one more.
   *
   * English calls the finished thing a **movie**, never a «video» or a «montage» — the api's push
   * settled that word (TASK-88) and the app must not call one thing two things: «video» is already
   * taken by what people upload («Photos and videos», `media.video`). The Russian «ролик» carries
   * that separation on its own, which is why only the English side needed deciding.
   */
  montage: {
    /**
     * The second face of a memory, on the switch under its name (kit, «Экраны» 5). Plural: the face
     * holds every movie this memory has, and the one being watched is named by its length below.
     */
    title: 'Movies',
    status: {
      queued: 'Waiting its turn',
      processing: 'Being made',
      ready: 'Ready',
      failed: 'Did not finish',
    },
    /** The worker's five tracks, under names to pick between. The ids are the api's own. */
    track: { bright: 'Bright', warm: 'Warm', calm: 'Calm', night: 'Night', road: 'Road' },
    /** Three round answers out of the range the api takes, keyed by the seconds asked for. */
    length: { 30: 'Half a minute', 60: 'A minute', 120: 'Two minutes' },
    /**
     * Which way up the movie comes out, by the api's own two ids. Said as the shape it has and not
     * as «landscape/portrait» — the words on the sheet are for whoever is about to watch it on a
     * phone, and one of these is for sharing to a story.
     */
    orientation: { landscape: 'Wide', portrait: 'Tall' },
    /** How many a memory has, for the badge on its card — the Russian declines it, so it is a word. */
    count: (n: number) => `${n} ${n === 1 ? 'movie' : 'movies'}`,
    ofLength: (runtime: string) => `Movie of ${runtime}`,
    fromDay: (day: string) => `Movie from ${day}`,
    caption: 'You will be told when it is ready',
    /** The second line of a card that fell over, where a finished one says what it was made of. */
    broke: 'The cut broke off halfway',
    /** Spoken off the poster of a finished movie: the card is a button and the film is its name. */
    watch: (title: string) => `Watch ${title}`,
    saveShare: 'Save and share',
    /**
     * The last button of the order, the one word the whole wizard leads to — and the paper button
     * on the empty block, which is where an order starts when the memory has no film yet.
     */
    makeIt: 'Make it',
    /** The heading over the three lengths on the last step. */
    howLong: 'How long',
    music: 'Music',
    /** The heading over the two shapes, the way «How long» stands over the three lengths. */
    shape: 'Shape',
    /** The counter beside the heading of the block while the memory has no movie yet. */
    noneYet: 'none yet',
    /** The dashed tile that stands first in the strip, always: the one way a new movie is started. */
    newOne: 'New movie',
    /**
     * `FilmsEmpty` — what the block says where the strip would be. Empty is an invitation (spec 9),
     * so it says what the thing is rather than reporting an absence; the button beside it is the
     * organizer's, because ordering is theirs alone.
     */
    emptyNote: 'A neural network picks the best moments and sets them to music.',
    tooLittle: 'Too little material for a movie yet — add a few more photos or videos first.',
    orderDenied: 'Only the organizer can order a movie.',
    movedOn: 'That one has already moved on — reading the list again.',
    retryDenied: 'Only the organizer can start it again.',
    /** Handing the finished movie on did not happen — the download, or a phone with nowhere to send it. */
    shareFailed: 'Could not hand this movie on.',

    /**
     * Ordering, step by step (spec 8). One screen per step, and the words of each of them: the frame
     * of the wizard first, then the four steps in order, then the two sheets that stand in for one.
     */
    step: (n: number, of: number) => `Step ${n} of ${of}`,
    /** What the bar says over the total instead of a step: there is no step after it, and no scale. */
    summaryStep: 'Summary',
    next: 'Next',

    /** `MontageTemplate` — the way in: six ready-made films, and the door beside them. */
    templateTitle: 'What the movie will be',
    templateHint: 'Pick a template — the rest puts itself together.',
    /** The other door: the same four steps, walked by hand and starting from nothing. */
    ownSetup: 'Set it up myself',
    /**
     * Spec 6 — while the autopilot walks the steps. In the continuous, because it is happening
     * while the words are being read, and the button beside it is the wheel handed back.
     */
    autoGoing: 'Putting it together from the template',
    autoStop: 'Stop',

    /** Step 1 — what the automatic pass made of the material, and what to do about it. */
    pickTitle: 'Which frames to take',
    pickMeta: (taken: number, all: number) => `Taking ${taken} of ${all}`,
    passDropped: (n: number) => `${n} dropped automatically`,
    whatDropped: 'What was dropped',
    nextWith: (n: number) => `Next — ${n} ${n === 1 ? 'frame' : 'frames'}`,
    /**
     * Under the button that has gone dark: everything was crossed out, and there is no film in
     * nothing. It names the floor the api holds the order to rather than «at least one» — a
     * sentence that asked for one frame and then refused two would be the screen lying twice.
     */
    keepAtLeast: (n: number) => `Keep at least ${n} ${n === 1 ? 'frame' : 'frames'}`,
    /** Said of one frame, for whoever cannot see which circle is on it. */
    inMovie: 'Going into the movie',
    outOfMovie: 'Left out',

    /** `SheetRejected` — the pass reports, and every line of the report can be undone. */
    droppedTitle: 'What was dropped automatically',
    droppedText: (n: number, all: number) =>
      `${n} of ${all} frames. Nothing is lost — any of them comes back into the movie.`,
    /** Why a frame was dropped. `other` is a reason this app has no word for, not a silent one. */
    reason: {
      blur: 'Blurred',
      duplicate: 'Duplicates',
      exposure: 'Too dark',
      unreadable: 'Would not open',
      other: 'Not suitable',
    },
    /** What was kept instead — the half of «duplicates» that says nothing was actually lost. */
    keptBest: 'kept the best of the burst',
    bringBack: 'Bring back',
    bringBackAll: (n: number) => `Bring all ${n} back`,
    leaveAsIs: 'Leave as is',

    /** Step 2 — the words the director is given, or none. */
    storyTitle: 'How to cut this movie',
    storyHint: 'This can be skipped — then the director decides.',
    /** The box has no visible label: the screen's own heading is the label (spec 7.9). */
    storyLabel: 'The story of the movie',
    storyPlaceholder:
      'Liza and Mark’s wedding. Start with the morning, then the ceremony, and end on the dancing.',
    /**
     * The six ready-made films, by the api's own ids and in the order it hands them out. The server
     * writes the story of each and sends the length and the shape; the name on the tile is the
     * app's, because it is a word and not a fact about this memory. The three video sites are their
     * own names in both languages.
     */
    template: {
      for_myself: 'For myself',
      quick: 'Quick and lively',
      report: 'An official report',
      short_form: 'TikTok · Reels · Shorts',
      parents: 'For the parents',
      dopamine: 'Dopamine bomb',
    },
    /** The second line on a tile: what that kind of film is like, in three or four words. */
    templateNote: {
      for_myself: 'Personal, unhurried',
      quick: 'Lively, on the beat',
      report: 'Even, in order',
      short_form: 'Hooks from the first second',
      parents: 'Faces, warmth, a little slower',
      dopamine: 'As sharp as it gets',
    },
    /** The plate over the story: which template wrote what is in the box. */
    fromTemplate: (name: string) => `«${name}» template`,
    /** And what that plate becomes the moment the words are edited — they are the person's now. */
    ownText: 'Your own text',

    /** Step 3 — the shelf of tracks, or one off this phone. */
    musicTitle: 'What to cut it to',
    musicHint: 'No music at all, or one track — or several.',
    /** The round button on every row of the shelf — spoken only, and it says which track it is. */
    listen: (track: string) => `Play ${track}`,
    stopTrack: (track: string) => `Stop ${track}`,
    /** A track off the phone — on its pill, its row, the summary and a finished movie's card. */
    ownTrackShort: 'Your own track',
    sendingTrack: 'Sending the track…',
    /**
     * The card standing where the chosen tracks would be. Silence is a decision and it says what
     * it actually gives you, which is not silence at all: whatever the videos themselves recorded.
     */
    noMusic: 'No music',
    noMusicNote: 'Just the live sound from the videos',
    /** The block of what was taken, and how much of it there is. */
    picked: 'Chosen',
    tracksPicked: (n: number) => `${n} ${n === 1 ? 'track' : 'tracks'}`,
    /** The two round buttons of a shelf row — spoken, because both of them are a glyph alone. */
    addTrack: (track: string) => `Add ${track}`,
    dropTrack: (track: string) => `Remove ${track}`,
    /** The wave a chosen row is dragged by, for whoever cannot drag anything. */
    moveTrack: (track: string) => `Move ${track}`,
    /** The 44 line under the chosen tracks: the one thing a person can say about how to use them. */
    musicNote: 'How to use the tracks',
    musicNotePlaceholder: 'How to use them: «Warm» over the morning…',

    /** Step 4 — how long it runs and which way up, and nothing else. */
    buildTitle: 'How to put it together',
    /** Over the card on the right: the ceiling, which is this memory's material and not a rule. */
    lengthUpTo: (max: string) => `up to ${max}`,
    /** The right end of the line, where the ceiling means «everything there is». */
    lengthEnd: (max: string) => `${max} · everything there is`,
    /** The fifth ready answer: not a number, because it is whatever the material comes to. */
    lengthAll: 'All',
    /** Under the figure, while the length is still the one the template asked for. */
    lengthFromTemplate: (name: string) => `from the «${name}» template`,
    /** The two round buttons beside the figure — five seconds either way, spoken. */
    shorter: 'Five seconds shorter',
    longer: 'Five seconds longer',
    /** The three summary rows, each of them the way back to the step that settled it. */
    story: 'Story',
    /** «Bright · on the beat» — the track and what it does to the cuts. */
    onTheBeat: 'on the beat',
    directorDecides: 'The director decides',
    /** The last button of step 4: what is after it is the summary and not the making. */
    toSummary: 'To the summary',

    /**
     * `MontageSummary` — the order read back before it is spent. Everything counted in it is the
     * api's own answer and nothing on the screen can be edited, so these are all read-only words.
     */
    summaryTitle: 'Everything is ready',
    /** «168 photos · 46 videos» — the frames that are actually going in, counted by the api. */
    shots: (photos: number, videos: number) =>
      `${photos} ${photos === 1 ? 'photo' : 'photos'} · ${videos} ${videos === 1 ? 'video' : 'videos'}`,
    /** Beside that count: how many people brought them. */
    byPeople: (n: number) => `from ${n} ${n === 1 ? 'person' : 'people'}`,
    /** The music section with nothing in it — which is an answer and not a gap. */
    noMusicLive: 'No music · the sound of the video itself',
    /** The line with the clock, and the only promise the screen makes about time. */
    readyIn: (minutes: number) =>
      `It takes about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} — we will send you a notice.`,
    /** The one button the whole wizard leads to. */
    startCut: 'Start the cut',
    /**
     * The length was fine when it was picked and is not any more — the frames changed under it.
     * The two edges are the ones the api refused with, drawn the way step 4 draws a length.
     */
    lengthOff: (min: string, max: string) =>
      `That length does not fit the frames you picked — it can be ${min} to ${max} now. Go back and choose another.`,
    /** Frames the order names were deleted while the wizard stood open. */
    framesGone: 'Some of the frames in this order are gone — go back and check the selection.',
    /** The two ways back out of a refusal, straight to the step that can undo it. */
    toFrames: 'Back to the frames',
    toLength: 'Back to the length',
    /**
     * «Отмена» with something already said — the gentle sheet, where nothing is destroyed but a
     * walk through four steps is.
     */
    leaveAsk: 'Leave the order?',
    leaveText: 'The frames, the story and the music picked here are not kept.',
    leaveDo: 'Leave',
    stay: 'Stay',

    /**
     * The five stages of the making, under the codes the journal calls them by (`MONTAGE_STAGES`).
     * Named and not counted: «73 %» tells a person nothing, «the director builds the story» tells
     * them where it is.
     */
    stage: {
      screening: 'Dropping the spoiled frames',
      understanding: 'Working out what is in them',
      directing: 'The director builds the story',
      rhythm: 'Laying them out to the beat',
      assembly: 'Cutting it together',
    },

    /**
     * «Монтаж в прямом эфире» (spec 7.6, 7.7) — the words the director's journal is read in. The
     * names of the five stages are `stage` above; these are what is said *inside* one of them.
     *
     * The voice is the spec's own rule for this screen: first person and short — «Taking three
     * seconds», never «the system processed». `@/lib/montage/journal` is what turns a record into them.
     */
    live: {
      /** Over the whole screen, while the worker still owes it. A fallen one wears `status.failed`. */
      title: 'The montage is on',
      /** And over the page the finished one gets — the same bar, with nothing left to watch. */
      doneTitle: 'The movie is ready',
      /** Beside its name up there: every stage of the making added up (`madeInMinutes`). */
      madeIn: (minutes: number) => `made in ${minutes} min`,
      /** The heading over the journal a finished movie keeps for ever. */
      howMade: 'How it was made',
      /**
       * The three numbers under that heading, each the answer to one word: how many frames were
       * looked at in all, how many the director took, and how many cuts came of them. The last is
       * the one noun of the three, so it agrees with its number.
       */
      watched: 'looked at',
      tookIn: 'taken in',
      glued: (n: number): string => (n === 1 ? 'cut' : 'cuts'),
      /** The pill of faces in the bar, said as one sentence to a screen reader. */
      watching: (n: number) => `Watching now: ${n}`,
      /** On the frame the director is holding, beside the live dot. */
      now: 'NOW',
      /** Who is speaking, and the same voice in two tenses. */
      director: 'The director',
      thinking: 'thinking…',
      decided: 'decided',
      /** Nothing in hand yet: the montage is still standing in the queue. */
      inQueue: 'Waiting for our turn',
      /** The read never came back. What was read stays on screen — this stands under it. */
      lost: 'Connection lost, holding on',
      /** The organizer's button under a montage that fell over. */
      retry: 'Start the montage again',
      /** How far along the making is, as a place in the five rather than as a percentage. */
      stageOf: (n: number, of: number) => `Stage ${n} of ${of}`,
      /** The estimate over the stages still to go. Deliberately approximate — it moves. */
      leftAbout: (minutes: number) => `about ${minutes} min left`,
      /** A stage's own time, beside what came of it. */
      minutes: (minutes: number) => `${minutes} min`,
      /** The same for the one being worked on — time spent, not time taken. */
      running: (minutes: number) => `${minutes} min so far`,
      /**
       * What came of a stage, one clause each, out of the keys the api names as countable
       * («Журнал монтажа»). A stage that has nothing to report yet says how far it has got instead.
       */
      kept: (n: number, of: number) => `${n} of ${of} are usable`,
      faces: (n: number) => `${n} ${n === 1 ? 'face' : 'faces'}`,
      parts: (n: number) => `${n} ${n === 1 ? 'part' : 'parts'}`,
      cuts: (n: number) => `${n} ${n === 1 ? 'cut' : 'cuts'}`,
      /** What the rhythm of a film with no music came to — in place of «0 cuts», which is no answer. */
      noTrack: 'no music, nothing to fit to',
      doneOf: (n: number, of: number) => `${n} of ${of}`,
      /** Under the stage in hand: the way into everything it has said. */
      wholeStage: (n: number) => `The whole stage journal · ${n} ${n === 1 ? 'record' : 'records'}`,
      /** The time over a record that landed while somebody was watching. */
      justNow: 'just now',
      /** The four chips over the journal. Two of them carry the api's own count beside the word. */
      all: 'All',
      thoughts: 'Thoughts',
      took: 'Took',
      /** «ЧТО УВИДЕЛ» — the eyebrow over the words the director saw on a frame. */
      saw: 'What it saw',
      /** Where a frame ended up: «Part 2 «Vows» · 1:12–1:16», and how many other places it has. */
      partOf: (n: number, title?: string) => (title ? `Part ${n} «${title}»` : `Part ${n}`),
      morePlaces: (n: number) => `and ${n} more`,
      /** The decision itself, and the three ways it is qualified. */
      take: 'Taking',
      skip: 'Passing',
      tookOneOf: (n: number) => `Took 1 of ${n}`,
      /** «Taking 0:04–0:07» — the piece of a video that is going in, not the whole file. */
      tookFrom: (from: string, to: string) => `Taking ${from}–${to}`,
      part: (n: number) => `part ${n}`,
      /**
       * Why the director decided as it did, by the worker's own codes — every one of them about a
       * frame passed over but `included`. The list is the worker's vocabulary and not a closed set —
       * the api puts no check on it — so anything this side has no word for is `other`, which is
       * still an honest answer about a frame nobody took.
       */
      reason: {
        blur: 'Blurred',
        exposure: 'The light is off',
        unreadable: 'Would not open',
        duplicate: 'A double',
        /** Struck off by hand at the order — the director had no say in this one. */
        excluded: 'Left out at the order',
        /** Good enough, but the movie is only so long. */
        no_room: 'No room left',
        /** The director's own choice to leave it out — its words about why are the record's thought. */
        left_out: 'Not in the story',
        /** The one reason on a frame that was taken: the organizer asked for it at the order. */
        included: 'Taken at the organizer’s word',
        other: 'Not suitable',
      },
    },

    /** `SheetTooLittle` — raised in place of step 1, when the order would not go through. */
    tooLittleTitle: 'Too little material yet',
    tooLittleText: (n: number) =>
      `This memory has ${n} ${n === 1 ? 'frame' : 'frames'} — there is no story in that. Add a few more photos or videos and the order goes through.`,
    later: 'Later',
  },
};

export const ru: typeof en = {
  montage: {
    title: 'Ролики',
    status: {
      queued: 'Ждёт очереди',
      processing: 'Собирается',
      ready: 'Готов',
      failed: 'Не собрался',
    },
    track: { bright: 'Яркая', warm: 'Тёплая', calm: 'Спокойная', night: 'Ночь', road: 'Дорога' },
    length: { 30: 'Полминуты', 60: 'Минута', 120: 'Две минуты' },
    orientation: { landscape: 'Горизонтальный', portrait: 'Вертикальный' },
    count: (n: number) => count(n, 'ролик', 'ролика', 'роликов'),
    ofLength: (runtime: string) => `Ролик на ${runtime}`,
    fromDay: (day: string) => `Ролик от ${day}`,
    caption: 'Мы сообщим, когда будет готов',
    broke: 'Сборка оборвалась на полпути',
    watch: (title: string) => `Смотреть: ${title}`,
    saveShare: 'Сохранить и поделиться',
    makeIt: 'Смонтировать',
    howLong: 'Длина',
    music: 'Музыка',
    shape: 'Формат',
    noneYet: 'пока нет',
    newOne: 'Новый ролик',
    emptyNote: 'Нейросеть выберет лучшие моменты и положит на музыку.',
    tooLittle: 'Материала для ролика пока мало — добавьте ещё несколько фото или видео.',
    orderDenied: 'Заказать ролик может только организатор.',
    movedOn: 'С этим уже что-то произошло — перечитываем список.',
    retryDenied: 'Запустить заново может только организатор.',
    shareFailed: 'Не получилось поделиться роликом.',

    step: (n: number, of: number) => `Шаг ${n} из ${of}`,
    summaryStep: 'Итог',
    next: 'Дальше',

    templateTitle: 'Каким будет ролик',
    templateHint: 'Выберите шаблон — дальше всё соберётся само.',
    ownSetup: 'Настроить самому',
    autoGoing: 'Собираю по шаблону',
    autoStop: 'Стоп',

    pickTitle: 'Какие кадры взять',
    pickMeta: (taken: number, all: number) => `Возьмём ${taken} из ${all}`,
    passDropped: (n: number) => `${n} сняли автоматически`,
    whatDropped: 'Что сняли',
    nextWith: (n: number) => `Дальше — ${count(n, 'кадр', 'кадра', 'кадров')}`,
    keepAtLeast: (n: number) => `Оставьте хотя бы ${count(n, 'кадр', 'кадра', 'кадров')}`,
    inMovie: 'Берём в ролик',
    outOfMovie: 'Не берём',

    droppedTitle: 'Что сняли автоматически',
    droppedText: (n: number, all: number) =>
      `${count(n, 'кадр', 'кадра', 'кадров')} из ${all}. Ничего не потеряно — любой вернётся в ролик.`,
    reason: {
      blur: 'Размыто',
      duplicate: 'Дубли',
      exposure: 'Темно',
      unreadable: 'Не открылось',
      other: 'Не подошло',
    },
    keptBest: 'оставили лучший из серии',
    bringBack: 'Вернуть',
    bringBackAll: (n: number) => `Вернуть все ${n}`,
    leaveAsIs: 'Оставить как есть',

    storyTitle: 'Как смонтировать этот ролик',
    storyHint: 'Можно пропустить — тогда режиссёр решит сам.',
    storyLabel: 'История ролика',
    storyPlaceholder:
      'Свадьба Лизы и Марка. Начни со сборов утром, дальше церемония, а финал — танцы.',
    template: {
      for_myself: 'Для себя',
      quick: 'Быстрый, энергичный',
      report: 'Официальный отчёт',
      short_form: 'TikTok · Reels · Shorts',
      parents: 'Для родителей',
      dopamine: 'Дофаминовая бомба',
    },
    templateNote: {
      for_myself: 'Личное, без спешки',
      quick: 'Бодро, в ритм',
      report: 'Ровно, по порядку',
      short_form: 'Цепляет с первой секунды',
      parents: 'Лица, тепло, чуть медленнее',
      dopamine: 'Максимально резко',
    },
    fromTemplate: (name: string) => `Шаблон «${name}»`,
    ownText: 'Свой текст',

    musicTitle: 'Под что монтировать',
    musicHint: 'Без музыки или один-несколько треков.',
    listen: (track: string) => `Послушать «${track}»`,
    stopTrack: (track: string) => `Остановить «${track}»`,
    ownTrackShort: 'Свой трек',
    sendingTrack: 'Загружаем трек…',
    noMusic: 'Без музыки',
    noMusicNote: 'Только живой звук из видео',
    picked: 'Выбрано',
    tracksPicked: (n: number) => count(n, 'трек', 'трека', 'треков'),
    addTrack: (track: string) => `Добавить «${track}»`,
    dropTrack: (track: string) => `Убрать «${track}»`,
    moveTrack: (track: string) => `Переставить «${track}»`,
    musicNote: 'Как использовать треки',
    musicNotePlaceholder: 'Как использовать треки: «Тёплая» — на сборы…',

    buildTitle: 'Как собрать',
    lengthUpTo: (max: string) => `до ${max}`,
    lengthEnd: (max: string) => `${max} · всё, что есть`,
    lengthAll: 'Всё',
    lengthFromTemplate: (name: string) => `из шаблона «${name}»`,
    shorter: 'Короче на 5 секунд',
    longer: 'Длиннее на 5 секунд',
    story: 'История',
    onTheBeat: 'в ритм',
    directorDecides: 'Режиссёр решит сам',
    toSummary: 'К итогу',

    summaryTitle: 'Всё готово к монтажу',
    shots: (photos: number, videos: number) => `${photos} фото · ${videos} видео`,
    byPeople: (n: number) => `от ${count(n, 'человека', 'человек', 'человек')}`,
    noMusicLive: 'Без музыки · живой звук',
    readyIn: (minutes: number) =>
      `Соберём примерно за ${count(minutes, 'минуту', 'минуты', 'минут')} и пришлём уведомление.`,
    startCut: 'Начать монтаж',
    lengthOff: (min: string, max: string) =>
      `Такая длина не подходит к выбранным кадрам — сейчас можно от ${min} до ${max}. Вернитесь и выберите другую.`,
    framesGone: 'Части кадров из заказа уже нет — вернитесь и проверьте выбор.',
    toFrames: 'К кадрам',
    toLength: 'К длине',
    leaveAsk: 'Выйти из заказа?',
    leaveText: 'Выбранные здесь кадры, история и музыка не сохранятся.',
    leaveDo: 'Выйти',
    stay: 'Остаться',

    stage: {
      screening: 'Отсев брака',
      understanding: 'Разбираем, что на кадрах',
      directing: 'Режиссёр строит историю',
      rhythm: 'Раскладываем в ритм трека',
      assembly: 'Склеиваем',
    },

    live: {
      title: 'Монтаж идёт',
      doneTitle: 'Ролик готов',
      madeIn: (minutes: number) => `собран за ${minutes} мин`,
      howMade: 'Как собирался',
      watched: 'просмотрел',
      tookIn: 'взял в ролик',
      glued: (n: number) => form(n, 'склейка', 'склейки', 'склеек'),
      watching: (n: number) => `Смотрят сейчас: ${n}`,
      now: 'СЕЙЧАС',
      director: 'Режиссёр',
      thinking: 'думает…',
      decided: 'решил',
      inQueue: 'Ждём очереди',
      lost: 'Связь пропала, ждём',
      retry: 'Повторить монтаж',
      stageOf: (n: number, of: number) => `Этап ${n} из ${of}`,
      leftAbout: (minutes: number) => `осталось ≈ ${minutes} мин`,
      minutes: (minutes: number) => `${minutes} мин`,
      running: (minutes: number) => `идёт ${minutes} мин`,
      kept: (n: number, of: number) => `${n} из ${of} годятся`,
      faces: (n: number) => count(n, 'лицо', 'лица', 'лиц'),
      parts: (n: number) => count(n, 'часть', 'части', 'частей'),
      cuts: (n: number) => count(n, 'склейка', 'склейки', 'склеек'),
      noTrack: 'без музыки, подгонять не подо что',
      doneOf: (n: number, of: number) => `${n} из ${of}`,
      wholeStage: (n: number) => `Весь журнал этапа · ${count(n, 'запись', 'записи', 'записей')}`,
      justNow: 'сейчас',
      all: 'Всё',
      thoughts: 'Мысли',
      took: 'Взял',
      saw: 'Что увидел',
      partOf: (n: number, title?: string) => (title ? `Часть ${n} «${title}»` : `Часть ${n}`),
      morePlaces: (n: number) => `и ещё ${n}`,
      take: 'Беру',
      skip: 'Мимо',
      tookOneOf: (n: number) => `Взял 1 из ${n}`,
      tookFrom: (from: string, to: string) => `Беру ${from}–${to}`,
      part: (n: number) => `часть ${n}`,
      reason: {
        blur: 'Смазан',
        exposure: 'Свет не тот',
        unreadable: 'Не открылся',
        duplicate: 'Дубль',
        excluded: 'Убрали при заказе',
        no_room: 'Не влез',
        left_out: 'Не в истории',
        included: 'Взят по слову организатора',
        other: 'Не подошёл',
      },
    },

    tooLittleTitle: 'Материала пока мало',
    tooLittleText: (n: number) =>
      `В воспоминании ${count(n, 'кадр', 'кадра', 'кадров')} — из них истории не выйдет. Добавьте ещё несколько фото или видео, и заказ пройдёт.`,
    later: 'Позже',
  },
};
