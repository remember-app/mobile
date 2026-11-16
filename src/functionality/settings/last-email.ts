import { readSecret, writeSecret } from '@/integrations/secure';

const KEY = 'last-email';

/**
 * Почта последнего входа. Хранится отдельно от сессии, чтобы пережить выход
 * из аккаунта и подставить поле при следующем входе.
 */
export async function readLastEmail(): Promise<string | null> {
  return readSecret(KEY).catch(() => null);
}

export async function writeLastEmail(email: string): Promise<void> {
  await writeSecret(KEY, email);
}
