import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { uri: string; fileName: string };

/** Выбор одной картинки из галереи устройства — одно поведение на все формы. */
export async function pickImage(
  baseName: string,
  options?: ImagePicker.ImagePickerOptions,
): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    ...options,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
  return { uri: asset.uri, fileName: asset.fileName ?? `${baseName}.${extension}` };
}
