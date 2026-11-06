import { copyText, readText } from '@/integrations/clipboard';
import { shareText } from '@/integrations/share';

export { copyText, readText };

export function inviteLink(token: string): string {
  return `remember://invite?token=${encodeURIComponent(token)}`;
}

const TOKEN = /^[A-Za-z0-9_-]{16,}$/;

export function parseInvite(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  const found = /[?&]token=([^&#\s]+)/.exec(value)?.[1];
  if (!found) return TOKEN.test(value) ? value : null;
  try {
    const token = decodeURIComponent(found);
    return TOKEN.test(token) ? token : null;
  } catch {
    return null;
  }
}

export async function copyInviteLink(token: string): Promise<void> {
  await copyText(inviteLink(token));
}

export async function shareInviteLink(token: string, title?: string): Promise<void> {
  const url = inviteLink(token);
  await shareText(title === undefined ? url : `${title} — ${url}`, url);
}
