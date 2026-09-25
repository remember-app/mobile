import { count } from './plural';

/**
 * The words of the screen that picks frames off the phone and sends them.
 */
export const en = {
  /** Picking material off the phone, and the queue that sends it (`@/lib/upload/send`). */
  upload: {
    /** The screen's own name in the kit (screens, 7) — not the memory's, which it no longer wears. */
    title: 'Your frames',
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
    reading: 'Still reading the gallery…',
    /** The heading names what is missing, the paragraph says what to do about it (spec 7.8). */
    emptyTitle: 'Nothing to pick',
    emptyText: 'This phone’s gallery is empty. Shoot something — and the frames will show up here.',
    stillToSend: (n: number) => `${n} still to send`,
    carriesOn: 'The app can be put away — sending carries on.',
    /** The heading over the files the queue could not get out, «НЕ УШЛИ». */
    notSent: 'Not sent',
    dropFile: (name: string) => `Drop ${name} from the queue`,
    picked: (n: number) => `${n} selected`,
    pickedOf: (n: number, total: number) => `${n} selected of ${total}`,
    /** The one glowing button of the screen, carrying what it is about to take with it. */
    send: (n: number) => `Send ${n} ${n === 1 ? 'file' : 'files'}`,
    /** What the queue parks a file with. The filename is the phone's own and stays as it is. */
    gone: (name: string) => `${name} is no longer on this phone.`,
    partRefused: (part: number, status: number) => `Storage refused part ${part} (${status}).`,
    noReceipt: (part: number) => `Storage took part ${part} without a receipt.`,
    noLink: (part: number) => `The api signed no link for part ${part}.`,
    partSizeChanged: 'The part size changed.',
    partNotTaken: (part: number) => `Storage would not take part ${part}.`,
    /** doc-06, asked once: the sheet that comes up after the first files land in a memory. */
    askAll: 'Is that everything?',
    askAllText:
      'Or is there more still to come? The organizer sees your answer and knows whether to wait for you.',
    /** The line above that question — what has just gone, and the reason it is asked now. */
    sentToMemory: (n: number) => `${n} ${n === 1 ? 'file is' : 'files are'} in the memory`,
    moreToCome: 'More to come',
    thatsAll: 'That’s all',
  },
};

export const ru: typeof en = {
  upload: {
    title: 'Ваши кадры',
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
    reading: 'Ещё читаем галерею…',
    emptyTitle: 'Выбирать нечего',
    emptyText: 'Галерея этого телефона пуста. Снимите что-нибудь — и кадры появятся здесь.',
    stillToSend: (n: number) => `Осталось ${count(n, 'файл', 'файла', 'файлов')}`,
    carriesOn: 'Приложение можно свернуть — отправка продолжится.',
    notSent: 'Не ушли',
    dropFile: (name: string) => `Убрать ${name} из очереди`,
    picked: (n: number) => `Выбрано ${n}`,
    pickedOf: (n: number, total: number) => `Выбрано ${n} из ${total}`,
    send: (n: number) => `Отправить ${count(n, 'файл', 'файла', 'файлов')}`,
    gone: (name: string) => `${name} больше нет на этом телефоне.`,
    partRefused: (part: number, status: number) =>
      `Хранилище отказало на части ${part} (${status}).`,
    noReceipt: (part: number) => `Хранилище приняло часть ${part} без квитанции.`,
    noLink: (part: number) => `Сервер не подписал ссылку для части ${part}.`,
    partSizeChanged: 'Размер части изменился.',
    partNotTaken: (part: number) => `Хранилище не приняло часть ${part}.`,
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
};
