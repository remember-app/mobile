/**
 * Everything the app says, in the two languages it speaks (doc-8). One key, two sets, both written
 * by hand: the English is not a translation of the Russian and the Russian is not a translation of
 * the English — each is written the way that language says the thing. The kit's vocabulary is the
 * law on the Russian side: воспоминание, кадры, участники, ролик, and one word per action.
 *
 * `en` fixes the shape and `ru` has to fill it, so a key that gains a set and not the other stops
 * the typecheck rather than showing an English word inside a Russian screen. That promise is kept
 * file by file: every section here carries both sets, and the second is typed by the first.
 *
 * One file per section, in the order the app is walked — the words said everywhere first, then a
 * screen at a time. What is *not* here is anything a person wrote — a memory's title, a username, a
 * filename — and the api's own wording for a failure, which comes back down the wire already in a
 * language (TASK-91 is what tells it which).
 */
import * as account from './account';
import * as common from './common';
import * as gallery from './gallery';
import * as home from './home';
import * as login from './login';
import * as memory from './memory';
import * as montage from './montage';
import * as upload from './upload';

export const en = {
  ...common.en,
  ...login.en,
  ...home.en,
  ...memory.en,
  ...gallery.en,
  ...montage.en,
  ...upload.en,
  ...account.en,
};

/** The shape both sets keep. */
export type Strings = typeof en;

export const ru: Strings = {
  ...common.ru,
  ...login.ru,
  ...home.ru,
  ...memory.ru,
  ...gallery.ru,
  ...montage.ru,
  ...upload.ru,
  ...account.ru,
};

/** Both sets, by the language they belong to. */
export const strings = { en, ru };
