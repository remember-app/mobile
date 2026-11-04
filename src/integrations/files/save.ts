import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';

export async function saveToPhone(uri: string): Promise<boolean> {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) return false;
  await MediaLibrary.createAssetAsync(uri);
  return true;
}

export async function shareFile(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('sharing is not available on this device');
  await Sharing.shareAsync(uri);
}
