import { copyText, readText } from '@/integrations/clipboard';
import { shareText } from '@/integrations/share';

export { copyText, readText };

export function inviteLink(token: string): string {
  return `remember://invite?token=${encodeURIComponent(token)}`;
}

export async function copyInviteLink(token: string): Promise<void> {
  await copyText(inviteLink(token));
}

export async function shareInviteLink(token: string, title?: string): Promise<void> {
  const url = inviteLink(token);
  await shareText(title === undefined ? url : `${title} — ${url}`, url);
}
