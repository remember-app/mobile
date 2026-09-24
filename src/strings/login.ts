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
    sendCode: 'Send the code',
    /** The label over the six cells. */
    code: 'Code from the letter',
    sentTo: (email: string) => `Sent to ${email}`,
    /** The quiet button beside that line: another code to the same address. */
    again: 'Again',
    confirm: 'Confirm',
    /**
     * One line for every way six digits can fail (the api answers 401 to all of them on purpose),
     * and it says what to do rather than which half was wrong.
     */
    codeBad: 'That code did not work — check it, or ask for a new one.',
    codeSent: 'A new code is on its way.',
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
    lead: 'Before you come in — three things you are agreeing to.',
    /**
     * Deliberately not the layout's own sentence: there is no deleting a memory in this product,
     * so «until you delete them or the memory» would promise a door that does not exist. What
     * actually ends the storing is a frame deleted or the person leaving.
     */
    storage:
      'Your photos and video are stored with us until they are deleted, or until you leave the memory.',
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
    withApple: 'Продолжить с Apple',
    withGoogle: 'Продолжить с Google',
    providerUnavailable: (provider: string) => `Вход через ${provider} пока не работает.`,
    noIdentityToken: (provider: string) => `${provider} не вернул токен входа.`,
    withEmail: 'Продолжить по почте',
    email: 'Почта',
    emailPlaceholder: 'ivan@example.com',
    sendCode: 'Отправить код',
    code: 'Код из письма',
    sentTo: (email: string) => `Отправили на ${email}`,
    again: 'Ещё раз',
    confirm: 'Подтвердить',
    codeBad: 'Код не подошёл — проверьте его или запросите новый.',
    codeSent: 'Отправили новый код.',
    mailDown: 'Сейчас мы не можем отправлять коды для входа — попробуйте позже.',
    devCode: 'Вход для разработки: почты здесь нет, код подставлен.',
  },

  consent: {
    lead: 'Прежде чем войти — три вещи, на которые вы соглашаетесь.',
    storage:
      'Ваши фото и видео хранятся у нас, пока их не удалят или вы не выйдете из воспоминания.',
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
