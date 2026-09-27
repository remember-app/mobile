import { count, form } from './plural';

/**
 * The words of one's own frames: picking them off the phone, sending them, and what became of them.
 */
export const en = {
  /** Picking material off the phone, and the queue that sends it (`@/lib/upload/send`). */
  upload: {
    /**
     * The screen's own name (spec 8, `Upload` and its states) — the same action as «Add more» on the
     * memory's feed, said where nothing has been added yet (spec 9).
     */
    title: 'Add frames',
    /** Under it in the glass capsule: where all this is going, and the memory named inside it. */
    into: (memory: string) => `to «${memory}»`,
    /**
     * The round button on the right of that capsule. It is a switch and not an action, so it is
     * named by what it turns on rather than by what the next tap will do.
     */
    picking: 'Picking mode',
    explain:
      'Remember cannot see a thing in your gallery until you say so — and what you pick stays on this phone until you send it.',
    refused:
      'The phone only asks once, and the answer was no. Turning it back on is in Settings, under Remember.',
    allow: 'Allow access',
    limited:
      'Only the photos you handed to Remember are here — the rest of the gallery is invisible to this screen, and to the «select all» on every day in it.',
    chooseMore: 'Choose more',
    /** Under a day's strip, once that day is a window on a day rather than the whole of it. */
    restUnseen: 'Remember cannot see the rest of this day',
    cannotRead: 'Cannot read the gallery on this phone.',
    /** Over one strip of the contact sheet: the day everything under it was shot on. */
    shotOn: (day: string) => `Shot on ${day}`,
    /** And at the other end of that line — everything shot on that one day, in one tap. */
    selectDay: (n: number) => `Select all ${n}`,
    /** The same button once the whole day is taken: the next tap gives it back. */
    unselectDay: (n: number) => `Unselect all ${n}`,
    /**
     * The seam of a day on the feed, read out (spec detail 65): the band's own words are a date and
     * a figure, so what it does is said with the day it does it to — and which way it goes now.
     */
    takeDay: (day: string) => `Select every frame from ${day}`,
    leaveDay: (day: string) => `Unselect every frame from ${day}`,
    reading: 'Still reading the gallery…',
    /** The heading names what is missing, the paragraph says what to do about it (spec 7.8). */
    emptyTitle: 'Nothing to pick',
    emptyText: 'This phone’s gallery is empty. Shoot something — and the frames will show up here.',
    stillToSend: (n: number) => `${n} still to send`,
    carriesOn: 'The app can be put away — sending carries on.',
    /**
     * The sending's own block while an original is coming down from iCloud — «Оптимизация
     * хранения» keeps it off the phone. It stands where «Sending» does, and the bar under it at
     * nought until the file is here: the phone reports no progress for that download (TASK-419).
     */
    fromCloud: 'The frame is coming down from iCloud',
    /** The head of the block of files the queue could not get out, «Не ушли 12 файлов». */
    notSent: (n: number) => `${n} ${n === 1 ? 'file' : 'files'} not sent`,
    /** Its button: every file of the block, again. */
    again: 'Send again',
    /** The cross on one file's line, read out with the file's own name. */
    dropFile: (name: string) => `Drop ${name} from the queue`,
    /** The line folding the rest of the block away, and the same line once it is open. */
    folded: (n: number) => `${n} more`,
    fold: 'Show less',
    /** What is still to send, in the line over «My frames»: «осталось 9». */
    left: (n: number) => `${n} left`,
    /** The line of failures in it, and the way from it into the queue. */
    notSentLine: (n: number) => `${n} ${n === 1 ? 'file' : 'files'} did not go`,
    sortOut: 'Sort out',
    picked: (n: number) => `${n} selected`,
    pickedOf: (n: number, total: number) => `${n} selected of ${total}`,
    /** The one glowing button of the screen, carrying what it is about to take with it. */
    send: (n: number) => `Send ${n} ${n === 1 ? 'file' : 'files'}`,
    /**
     * Why files were parked — each said of one file or of many, since a line of them stands under
     * «3 files». A storage code, where there was one, is put after the words in brackets.
     */
    gone: 'No longer on this phone',
    /** The gallery still has it; the phone could not read it. About the file, never a server. */
    unreadable: 'Could not be read from the phone’s gallery',
    /** iCloud has the original and would not hand it over — about iCloud, never the phone. */
    iCloud: 'Could not be brought down from iCloud',
    storageRefused: 'Storage refused',
    /** Storage, not the api: the connection to it dropped or went quiet mid-part. */
    storageOffline: 'The connection to storage broke off',
    noLink: 'The api signed no link for a part',
    partSizeChanged: 'The part size changed',
    /** doc-06, asked once: the sheet that comes up after the first files land in a memory. */
    askAll: 'Is that everything?',
    askAllText:
      'Or is there more still to come? The organizer sees your answer and knows whether to wait for you.',
    /** The line above that question — what has just gone, and the reason it is asked now. */
    sentToMemory: (n: number) => `${n} ${n === 1 ? 'file is' : 'files are'} in the memory`,
    moreToCome: 'More to come',
    thatsAll: 'That’s all',
  },

  /**
   * `MyFrames` and `SheetMyFrame` (spec 8) — what somebody has given a memory, what became of each
   * frame, and what they may still change about their own.
   */
  mine: {
    title: 'My frames',
    back: 'Back to the memory',
    /** The capsule's second line: how many of one's own are in, and how many are on their way. */
    inMemory: (n: number) => `${n} in the memory`,
    flying: (n: number) => `${n} on the way`,
    /** A tile read out with what became of it — the sign on it says nothing to a screen reader. */
    sending: (percent: string) => `sending, ${percent}`,
    stuck: 'not sent',
    hidden: 'hidden',
    emptyTitle: 'Nothing of yours yet',
    emptyText:
      'The photos and videos you add to this memory will stand here, and so will what became of each.',
    /** The two properties of the sheet, and what either says with nothing in it. */
    shot: 'Shot',
    none: 'Not set',
    hide: 'Hide from the feed',
    hideNote: 'Stays with you, stays out of the movie',
    deleteAll: 'Delete for everyone',
    /** The clock of «Shot», typed back in, and how it is written. */
    time: 'Time',
    timeWrong: 'Write the time like 18:42',
    /** «Place» typed back in, and what is said when the phone finds no such place. */
    where: 'Where it was',
    wherePlaceholder: 'A town, an address or a place',
    whereMissing: 'No such place found — try writing it another way',
    whereClear: 'Remove the place',
  },
};

export const ru: typeof en = {
  upload: {
    title: 'Добавить кадры',
    into: (memory: string) => `в «${memory}»`,
    picking: 'Режим выбора',
    explain:
      'Remember не видит вашу галерею, пока вы не разрешите, — а выбранное остаётся на телефоне, пока вы не отправите его.',
    refused:
      'Телефон спрашивает один раз, и ответ был «нет». Включить обратно можно в настройках, в разделе Remember.',
    allow: 'Разрешить доступ',
    limited:
      'Здесь только те снимки, что вы отдали Remember, — остальная галерея этому экрану не видна, и «Выбрать все» в каждом дне тоже.',
    chooseMore: 'Отдать ещё',
    restUnseen: 'Остальное с этого дня Remember не видит',
    cannotRead: 'Не получилось прочитать галерею на этом телефоне.',
    shotOn: (day: string) => `Снято ${day}`,
    selectDay: (n: number) => `Выбрать все ${n}`,
    unselectDay: (n: number) => `Снять все ${n}`,
    takeDay: (day: string) => `Выбрать все кадры за ${day}`,
    leaveDay: (day: string) => `Снять выбор со всех кадров за ${day}`,
    reading: 'Ещё читаем галерею…',
    emptyTitle: 'Выбирать нечего',
    emptyText: 'Галерея этого телефона пуста. Снимите что-нибудь — и кадры появятся здесь.',
    stillToSend: (n: number) => `Осталось ${count(n, 'файл', 'файла', 'файлов')}`,
    carriesOn: 'Приложение можно свернуть — отправка продолжится.',
    fromCloud: 'Кадр подгружается из iCloud',
    notSent: (n: number) =>
      `Не ${form(n, 'ушёл', 'ушли', 'ушли')} ${count(n, 'файл', 'файла', 'файлов')}`,
    again: 'Ещё раз',
    dropFile: (name: string) => `Убрать ${name} из очереди`,
    folded: (n: number) => `Ещё ${count(n, 'файл', 'файла', 'файлов')}`,
    fold: 'Свернуть',
    left: (n: number) => `осталось ${n}`,
    notSentLine: (n: number) =>
      `${count(n, 'файл', 'файла', 'файлов')} не ${form(n, 'ушёл', 'ушли', 'ушли')}`,
    sortOut: 'Разобрать',
    picked: (n: number) => `Выбрано ${n}`,
    pickedOf: (n: number, total: number) => `Выбрано ${n} из ${total}`,
    send: (n: number) => `Отправить ${count(n, 'файл', 'файла', 'файлов')}`,
    gone: 'Больше нет на этом телефоне',
    unreadable: 'Телефон не смог прочитать из галереи',
    iCloud: 'Не удалось скачать из iCloud',
    storageRefused: 'Хранилище отказало',
    storageOffline: 'Связь с хранилищем оборвалась',
    noLink: 'Сервер не подписал ссылку для одной из частей',
    partSizeChanged: 'Размер части изменился',
    askAll: 'Это всё?',
    askAllText:
      'Или что-то ещё осталось? Организатор увидит ваш ответ и поймёт, ждать вас или нет.',
    // Один файл ушёл, а двенадцать ушли: счёт даёт форму существительного, а глагол идёт за ним.
    sentToMemory: (n: number) =>
      `${count(n, 'файл', 'файла', 'файлов')} ${
        n % 10 === 1 && n % 100 !== 11 ? 'ушёл' : 'ушли'
      } в воспоминание`,
    moreToCome: 'Ещё будет',
    thatsAll: 'Больше ничего',
  },

  mine: {
    title: 'Мои кадры',
    back: 'Назад к воспоминанию',
    inMemory: (n: number) => `${n} в воспоминании`,
    flying: (n: number) => `${n} ${form(n, 'летит', 'летят', 'летят')}`,
    sending: (percent: string) => `отправляется, ${percent}`,
    stuck: 'не ушёл',
    hidden: 'скрыт',
    emptyTitle: 'Своих кадров пока нет',
    emptyText:
      'Здесь встанут фото и видео, которые вы добавите в воспоминание, — и будет видно, что с каждым стало.',
    shot: 'Снято',
    none: 'Не указано',
    hide: 'Скрыть из ленты',
    hideNote: 'Останется у вас, в ролик не попадёт',
    deleteAll: 'Удалить у всех',
    time: 'Время',
    timeWrong: 'Время пишется так: 18:42',
    where: 'Где это было',
    wherePlaceholder: 'Город, адрес или место',
    whereMissing: 'Такого места не нашли — попробуйте написать иначе',
    whereClear: 'Убрать место',
  },
};
