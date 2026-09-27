/**
 * The words of the way in — the three ways to sign in, what is agreed to on the way, and the screen
 * an invitation link opens on.
 */
export const en = {
  /**
   * The way in. The provider names are trademarks and stay as they are written, and the screen's
   * one heading is the product's own name (TASK-77) — which is not a word either language owns.
   */
  login: {
    /**
     * The one line under the name, and the whole product in it: what lands here, and what comes out
     * of it. Nothing else on the screen explains anything — the first screen after the way in does
     * that better than any paragraph here would.
     */
    promise:
      'After the event the frames scatter across ten phones. Here they come back together — and turn into a film.',
    /** The one progress over the whole way in, read out (spec 7.1, detail 75). */
    step: (n: number) => `Step ${n} of 5`,
    /**
     * The heads of the steps after the first (detail 76): together with the promise they tell in
     * short what the app is — one feed, a film out of it, what the network does, how people are
     * called in.
     */
    feed: {
      title: 'One feed for everyone',
      lead: 'Invite your people — and the frames from every phone land in one feed.',
    },
    film: {
      title: 'And then a film',
      lead: 'A neural network cuts a film out of the shared feed — you decide what kind.',
    },
    withApple: 'Continue with Apple',
    withGoogle: 'Continue with Google',
    /**
     * The screen drops a way in it cannot walk instead of standing it there switched off, so
     * nothing says «not on this device» out loud any more. This one is the other case: the way in
     * looked open, the server turned it down (501), and that has to be answered in words.
     */
    providerUnavailable: (provider: string) => `${provider} sign-in isn't available yet.`,
    noIdentityToken: (provider: string) => `${provider} did not return an identity token.`,
    /** The third door, the same size as the other two: it opens the screen where the address is typed. */
    withEmail: 'Continue with email',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    /** The address the api refused as not an address (400) — beside the label, in capitals. */
    checkAddress: 'Check the address',
    sendCode: 'Send the code',
    /**
     * The head over the six cells, before the address as it was typed: the screen writes these
     * words in capitals and leaves the address alone (spec, detail 80).
     */
    codeTo: 'Code sent to',
    /** The button beside that head: another code to the same address. */
    again: 'Again',
    /** And that button for the minute after it was pressed. */
    againIn: (time: string) => `Again in ${time}`,
    confirm: 'Confirm',
    /**
     * The head over the cells once the api refused the digits — one line for every way six digits
     * can fail (the api answers 401 to all of them on purpose).
     */
    codeBad: 'That code did not work',
    /**
     * 503 is the api saying it has no mail keys. Its own wording for that is written for whoever
     * runs it, so the screen answers in its own words rather than passing the server's along.
     */
    mailDown: "We can't send sign-in codes right now — try again later.",
    /**
     * Shown only where the api has its development door open and hands the code straight back
     * instead of posting it. It has to read as the workbench and not as a way in anybody was meant
     * to have, so it says so first.
     */
    devCode: 'Development sign-in: no mail here, so the code is filled in for you.',
  },

  /**
   * The agreement, which is the one thing that has to happen before a person may register
   * (doc-04, decision-9). The screen carries the short version of each of the three points and the
   * sheet carries the text itself — the app ships it, nothing is fetched.
   */
  consent: {
    title: 'Before you come in',
    lead: 'Three things you are agreeing to.',
    /** The layout's own sentence (`Consent.json` e9): two lines in the card, as the layout sets it. */
    storage: 'Your photos and videos are stored with us until you delete them or the memory.',
    /** The highlighted line, in three pieces so the middle one can carry the weight. */
    recognisesBefore: 'A neural network goes through the frames and ',
    recognises: 'recognises the faces of people and animals in them',
    recognisesAfter: ' — there is no film without that.',
    training: 'Your material is not used to train anybody else’s models.',
    readFull: 'The full text of the agreement',
    accept: 'I accept',
    accepting: 'Accepting',
    /** Under the button: there is no decline button, and this is why. */
    required: 'You cannot register without agreeing.',
    /** The text itself, as the sheet shows it. */
    agreement: {
      title: 'Remember user agreement (pilot)',
      lead: 'By registering with Remember, you agree to the following:',
      parts: [
        {
          title: '1. Storing media',
          text: 'Your photos and video are stored with us until they are deleted, or until you leave the memory or are removed from it.',
        },
        {
          title: '2. Recognition and transcription',
          text: 'To assemble a film that means something out of your frames, rather than a random cut, a neural network goes through the photos and video: it recognises the faces of people and animals in them — it works out that the same person or pet is in different frames — and in video it transcribes the speech, that is, what was said. It does not work out who is speaking.',
        },
        {
          title: '3. Processing by an outside cloud, with no training on your data',
          text: 'Frames go out to an outside cloud neural network service to be analysed. Your material is not used to train its models.',
        },
      ],
      tail: 'Without accepting this agreement you cannot register with Remember.',
    },
  },

  /** Where an invite link lands. */
  join: {
    noToken: 'This link has no token in it — ask for a new one.',
    deadTitle: 'This invite no longer works',
    /** Nobody here did anything wrong, and the screen says so before it says what to do. */
    dead: 'The link was called back, or replaced with a newer one. Ask whoever invited you for a fresh one.',
    home: 'Go to my memories',
  },
};

export const ru: typeof en = {
  login: {
    promise:
      'После события кадры расходятся по десяти телефонам. Здесь они сходятся обратно — и становятся роликом.',
    step: (n: number) => `Шаг ${n} из 5`,
    feed: {
      title: 'Одна лента на всех',
      lead: 'Зовёте своих — и кадры со всех телефонов падают в одну ленту.',
    },
    film: {
      title: 'И сразу ролик',
      lead: 'Из общей ленты нейросеть соберёт ролик — каким, решаете вы.',
    },
    withApple: 'Продолжить с Apple',
    withGoogle: 'Продолжить с Google',
    providerUnavailable: (provider: string) => `Вход через ${provider} пока не работает.`,
    noIdentityToken: (provider: string) => `${provider} не вернул токен входа.`,
    withEmail: 'Продолжить по почте',
    email: 'Почта',
    emailPlaceholder: 'ivan@example.com',
    checkAddress: 'Проверьте адрес',
    sendCode: 'Отправить код',
    codeTo: 'Код на',
    again: 'Ещё раз',
    againIn: (time: string) => `Ещё раз через ${time}`,
    confirm: 'Подтвердить',
    codeBad: 'Код не подошёл',
    mailDown: 'Сейчас мы не можем отправлять коды для входа — попробуйте позже.',
    devCode: 'Вход для разработки: почты здесь нет, код подставлен.',
  },

  consent: {
    title: 'Прежде чем войти',
    lead: 'Три вещи, на которые вы соглашаетесь.',
    storage: 'Ваши фото и видео хранятся у нас, пока вы не удалите их или воспоминание.',
    recognisesBefore: 'Нейросеть разбирает кадры и ',
    recognises: 'узнаёт на них лица людей и животных',
    recognisesAfter: ' — без этого ролик не собрать.',
    training: 'Ваш материал не уходит на обучение чужих моделей.',
    readFull: 'Полный текст соглашения',
    accept: 'Принимаю',
    accepting: 'Принимаем',
    required: 'Без согласия зарегистрироваться нельзя.',
    agreement: {
      title: 'Пользовательское соглашение Remember (пилот)',
      lead: 'Регистрируясь в Remember, вы соглашаетесь с этим:',
      parts: [
        {
          title: '1. Хранение медиа',
          text: 'Ваши фото и видео хранятся у нас, пока их не удалят или пока вы не выйдете из воспоминания либо не будете из него исключены.',
        },
        {
          title: '2. Распознавание и расшифровка',
          text: 'Чтобы собрать из ваших кадров осмысленный ролик, а не случайную нарезку, нейросеть разбирает фото и видео: распознаёт на них лица людей и животных — понимает, что на разных кадрах один и тот же человек или питомец, — а в видео расшифровывает речь, то есть что сказано. Кто именно говорит, она не определяет.',
        },
        {
          title: '3. Обработка — сторонним облаком, без обучения на ваших данных',
          text: 'Кадры уходят на разбор стороннему облачному сервису нейросети. На обучение его моделей ваш материал не идёт.',
        },
      ],
      tail: 'Без принятия этого соглашения зарегистрироваться в Remember нельзя.',
    },
  },

  join: {
    noToken: 'В этой ссылке нет ключа — попросите новую.',
    deadTitle: 'Приглашение не действует',
    dead: 'Эту ссылку отозвали или заменили новой. Попросите свежую у того, кто вас звал.',
    home: 'К моим воспоминаниям',
  },
};
