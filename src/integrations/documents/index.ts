import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export const AUDIO_TYPES = Platform.OS === 'ios' ? ['public.audio'] : ['audio/*'];

export type PickedFile = {
  uri: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string | null;
};

export async function pickFiles(type: string[] = AUDIO_TYPES): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type,
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    uri: asset.uri,
    fileName: asset.name,
    sizeBytes: asset.size ?? new File(asset.uri).size,
    mimeType: asset.mimeType ?? null,
  }));
}
