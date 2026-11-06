import { copyText, readText } from '@/integrations/clipboard';
import { shareText } from '@/integrations/share';

export { copyText, readText };

export function inviteLink(token: string): string {
  return `remember://invite?token=${encodeURIComponent(token)}`;
}

const CODE = /^[A-Za-z0-9]{6}$/;

export function parseInvite(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  const found = /[?&](?:token|code)=([^&#\s]+)/.exec(value)?.[1];
  if (!found) return CODE.test(value) ? value : null;
  try {
    const code = decodeURIComponent(found);
    return CODE.test(code) ? code : null;
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
