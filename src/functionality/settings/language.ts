import { deviceLanguageCode } from '@/integrations/device/locale';
import { readSecret, writeSecret } from '@/integrations/secure';
import type { Language } from '@/types/language';

const KEY = 'language';

function deviceLanguage(): Language {
  return deviceLanguageCode() === 'ru' ? 'ru' : 'en';
}

export async function readLanguage(): Promise<Language> {
  const saved = await readSecret(KEY).catch(() => null);
  return saved === 'ru' || saved === 'en' ? saved : deviceLanguage();
}

export async function writeLanguage(next: Language): Promise<void> {
  await writeSecret(KEY, next);
}
