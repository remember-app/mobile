import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { Language } from '@/types/language';

import { en } from './resources/en';
import { ru } from './resources/ru';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function applyLanguage(next: Language): Promise<unknown> {
  return i18n.changeLanguage(next);
}

export function currentLanguage(): Language {
  return i18n.language === 'ru' ? 'ru' : 'en';
}

export { i18n };
