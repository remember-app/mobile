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
export const strings = { en, ru };
