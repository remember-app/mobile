import { Share } from 'react-native';

export async function shareText(message: string, url?: string): Promise<void> {
  await Share.share(url === undefined ? { message } : { message, url });
}
