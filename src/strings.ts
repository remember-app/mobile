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
    /** Putting a whole selection back — the quiet half of every footer that picks something. */
    clear: 'Clear',
    close: 'Close',
    /** The way out of a sheet that changes what is on screen while it is open. */
    done: 'Done',
    retry: 'Try again',
    delete: 'Delete',
    download: 'Download',
    /** Keeping what is on screen — the finished movie onto the phone it is watched on. */
    save: 'Save',
    share: 'Share',
    invite: 'Invite',
    send: 'Send',
    /**
     * The account and nothing else: leaving a memory is not offered anywhere anymore (TASK-113), and
     * the kit's screen 8 spells out which of the two exits this is.
     */
    logOut: 'Log out of your account',
    openSettings: 'Open settings',
    /** The 32 cross on the connection banner — the only way to put a message away by hand. */
    hide: 'Hide message',
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
    /**
     * The appbar of any screen of a memory before the memory itself has arrived — its own title
     * takes over then. One line for all four of them, so none of them stands under a different word
     * while it waits.
     */
    fallbackTitle: 'Memory',
    /**
     * The capsule of the glass bar said out loud (spec 8): it carries the memory's name and leads
     * into its settings, and the name alone would not say that it leads anywhere.
     */
    settings: (title: string) => `${title}. Memory settings and people`,
    /** The second line of that capsule while there is nothing in the memory yet (`FramesEmpty`). */
    nothingYet: 'nothing yet',
    /** Whoever brought a frame and is no longer on the roster. */
    someone: 'Someone',
    /**
     * What everybody put in, under the one word the whole app calls it by — the kit allows a thing
     * exactly one name, and this one had three (TASK-76): «frames» on the card, «Photos and videos»
     * on the guest list, «Gallery» over the contact sheet. «Video» stays what one record is
     * (`media.video`), never what a memory is full of.
     */
    frames: (n: number) => `${n} ${n === 1 ? 'frame' : 'frames'}`,
    /** The same word with nothing counted yet: a section's name, and a button before its count. */
    framesPlain: 'Frames',
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
   * The four standings of doc-06 — «прогресс у организатора», keyed by the api's own values. Three
   * words on screen, not four: the first two both read as «still to come», because the difference
   * between «has not started» and «is still adding» is the api's bookkeeping and not anything the
   * organizer does differently — the count beside the standing already says how far along they are
   * (doc-06, уточнено 2026-09-08).
   */
  standing: {
    not_started: 'Planning to upload',
    more_coming: 'Planning to upload',
    done: 'All uploaded',
    nothing: 'Nothing to add',
  },

  /** The main screen: every memory this account organizes or was invited to. */
  home: {
    title: 'Memories',
    /**
     * The one button in the header (spec 8, `Main`) and everything about you behind it — the
     * contact list moved inside it, so there is no second icon here to name any more.
     */
    account: 'Account',
    /** `HomeEmpty`, and the first thing anybody sees after signing up: a heading and an invitation. */
    emptyTitle: 'Nothing here yet',
    empty:
      'Start a memory for your next event — and the photos will land here from everyone who was there.',
    /** A memory with nothing in it at all — said on the film of its own card. */
    noFrames: 'No frames yet. Add the first ones.',
    /** Under the bar on a large card: how many of the guests have brought their frames in. */
    brought: (done: number, all: number) => `${done} of ${all} have already shared their frames`,
    /**
     * `HomeOffline` — said over a list that is still there. The screen goes on working; what it
     * cannot promise is that this is the latest, and that is the whole sentence.
     */
    offline: 'No connection to the server. Showing what is already loaded.',
    /** `HomeOnline` — one line with no way to dismiss it, because it leaves on its own. */
    online: 'Connected',
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

  /** Starting a memory: a title and the day (or span) the event happened on. */
  create: {
    title: 'New memory',
    titleLabel: 'Title',
    titlePlaceholder: 'Anna’s birthday',
    /** The `eyebrow` over the calendar, and the whole question the block below it asks. */
    eventDate: 'When it happened',
    /**
     * The one line under the calendar (spec 7.3, detail 15). It says how the thing works rather than
     * why it is asked for: there is no switch for «longer than a day» any more, and the second tap
     * is what nobody would find on their own.
     */
    dateHint: 'One day — one tap. Longer — the first day and the last.',
    /** The four quick days over the calendar, each one a whole answer. */
    today: 'Today',
    yesterday: 'Yesterday',
    weekend: 'Weekend',
    week: 'Week',
    /** «· 3 дня» beside the picked span. A single day never says it — it is a date, not a length. */
    days: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    /** What the calendar's two round buttons are called, since it knows no words of its own. */
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    submit: 'Create',
  },

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
    /** A 404 with no label in the path: the memory's own check, so this person was taken out of it. */
    memoryGone: 'You are no longer in this memory.',
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
    /** The line the share sheet goes out with. The memory's own title is not translated. */
    shareText: (title: string) => `Movie from «${title}»`,
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
     * Said without numbers on purpose: the range is the api's and it has already moved once.
     */
    lengthOff: 'That length does not fit the frames you picked — go back and choose another.',
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
     * seconds», never «the system processed». `@/montage-journal` is what turns a record into them.
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
       * looked at in all, how many the director took, and how many cuts came of them.
       */
      watched: 'looked at',
      tookIn: 'taken in',
      glued: 'cuts',
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
       * Why a frame was passed over, by the worker's own codes. The list is the worker's vocabulary
       * and not a closed set — the api puts no check on it — so anything this side has no word for
       * is `other`, which is still an honest answer about a frame nobody took.
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
        other: 'Not suitable',
      },
    },

    /** `SheetTooLittle` — raised in place of step 1, when the order would not go through. */
    tooLittleTitle: 'Too little material yet',
    tooLittleText: (n: number) =>
      `This memory has ${n} ${n === 1 ? 'frame' : 'frames'} — there is no story in that. Add a few more photos or videos and the order goes through.`,
    later: 'Later',
  },

  /** Picking material off the phone, and the queue that sends it (`@/uploads`). */
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
  language: {
    label: 'Language',
    ru: 'Русский',
    en: 'English',
    /** Where the pick reaches past this screen — the mails and the pushes the api writes (TASK-91). */
    hint: 'Letters and notifications come in it too.',
  },

  /** doc-9. The third one is not a light but the phone going on deciding. */
  theme: {
    label: 'Theme',
    system: 'As on phone',
    dark: 'Dark',
    light: 'Light',
    hint: 'Changes at once — this screen is the sample.',
  },
};

/** The shape both sets keep. */
export type Strings = typeof en;

export const ru: Strings = {
  action: {
    back: 'Назад',
    cancel: 'Отмена',
    clear: 'Снять',
    close: 'Закрыть',
    done: 'Готово',
    retry: 'Повторить',
    delete: 'Удалить',
    download: 'Скачать',
    save: 'Сохранить',
    share: 'Поделиться',
    invite: 'Пригласить',
    send: 'Отправить',
    logOut: 'Выйти из аккаунта',
    openSettings: 'Открыть настройки',
    hide: 'Скрыть сообщение',
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
    fallbackTitle: 'Воспоминание',
    settings: (title: string) => `${title}. Настройки воспоминания и люди`,
    nothingYet: 'пока пусто',
    someone: 'Кто-то',
    // «Кадры» — то самое слово кита, и теперь единственное: и карточка на главной, и переключатель
    // лиц воспоминания называют материал одинаково.
    frames: (n: number) => count(n, 'кадр', 'кадра', 'кадров'),
    framesPlain: 'Кадры',
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
    not_started: 'Планирует загрузить',
    more_coming: 'Планирует загрузить',
    done: 'Всё загрузил',
    nothing: 'Нечего добавлять',
  },

  home: {
    title: 'Воспоминания',
    account: 'Аккаунт',
    emptyTitle: 'Здесь пока пусто',
    empty:
      'Заведите воспоминание к ближайшему событию — и снимки начнут стекаться сюда от всех, кто там был.',
    noFrames: 'Кадров пока нет. Добавьте первые.',
    // Про людей, а не про файлы: считаются те, кто ответил за свой материал, — и сказано это
    // так же, как на «Людях» воспоминания.
    brought: (done: number, all: number) => `${done} из ${all} уже скинули свои кадры`,
    offline: 'Нет связи с сервером. Показываем то, что уже загружено.',
    online: 'Соединение установлено',
    create: 'Новое воспоминание',
  },

  about: {
    lead: 'Мобильный клиент.',
    apiUrl: 'Адрес сервера',
    hint: 'Чтобы указать другой сервер, задайте EXPO_PUBLIC_API_URL.',
    back: 'На главную',
  },

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

  create: {
    title: 'Новое воспоминание',
    titleLabel: 'Название',
    titlePlaceholder: 'День рождения Анны',
    eventDate: 'Когда это было',
    dateHint: 'Один день — одно касание. Несколько — первый и последний.',
    today: 'Сегодня',
    yesterday: 'Вчера',
    weekend: 'Выходные',
    week: 'Неделя',
    days: (n: number) => count(n, 'день', 'дня', 'дней'),
    prevMonth: 'Предыдущий месяц',
    nextMonth: 'Следующий месяц',
    submit: 'Создать',
  },

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

    brought: (day: string, n: number) => `принёс ${day} · всего ${count(n, 'кадр', 'кадра', 'кадров')}`,
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
    colours: ['жёлтый', 'розовый', 'красный', 'зелёный', 'голубой', 'фиолетовый', 'кислотный', 'серый'],
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
    memoryGone: 'Вас больше нет в этом воспоминании.',
  },

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
    shareText: (title: string) => `Ролик из «${title}»`,
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
    lengthOff: 'Такая длина не подходит к выбранным кадрам — вернитесь и выберите другую.',
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
      glued: 'склеек',
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
      doneOf: (n: number, of: number) => `${n} из ${of}`,
      wholeStage: (n: number) =>
        `Весь журнал этапа · ${count(n, 'запись', 'записи', 'записей')}`,
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
        other: 'Не подошёл',
      },
    },

    tooLittleTitle: 'Материала пока мало',
    tooLittleText: (n: number) =>
      `В воспоминании ${count(n, 'кадр', 'кадра', 'кадров')} — из них истории не выйдет. Добавьте ещё несколько фото или видео, и заказ пройдёт.`,
    later: 'Позже',
  },

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
    askAllText: 'Или что-то ещё осталось? Организатор увидит ваш ответ и поймёт, ждать вас или нет.',
    // Один файл ушёл, а двенадцать ушли: счёт даёт форму существительного, а глагол идёт за ним.
    sentToMemory: (n: number) =>
      `${count(n, 'файл', 'файла', 'файлов')} ${
        n % 10 === 1 && n % 100 !== 11 ? 'ушёл' : 'ушли'
      } в воспоминание`,
    moreToCome: 'Ещё будет',
    thatsAll: 'Больше ничего',
  },

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

/** Both sets, by the language they belong to. */
export const strings = { en, ru };
