import * as SecureStore from 'expo-secure-store';

export const readSecret = (key: string): Promise<string | null> => SecureStore.getItemAsync(key);

export const writeSecret = (key: string, value: string): Promise<void> =>
  SecureStore.setItemAsync(key, value);

export const removeSecret = (key: string): Promise<void> => SecureStore.deleteItemAsync(key);
