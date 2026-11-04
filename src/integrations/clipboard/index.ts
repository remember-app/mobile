import * as Clipboard from 'expo-clipboard';

export async function copyText(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

export async function readText(): Promise<string> {
  return Clipboard.getStringAsync();
}
