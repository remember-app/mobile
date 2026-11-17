import * as Clipboard from 'expo-clipboard';

export async function copyText(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

export async function readText(): Promise<string> {
  return Clipboard.getStringAsync();
}

export async function readImage(): Promise<string | null> {
  const image = await Clipboard.getImageAsync({ format: 'jpeg', jpegQuality: 0.9 });
  return image?.data ?? null;
}
