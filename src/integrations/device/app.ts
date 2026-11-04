import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type AppInfo = {
  version: string | null;
  build: string | null;
  runtime: string | null;
  platform: string;
  osVersion: string;
};

export function appInfo(): AppInfo {
  const config = Constants.expoConfig;
  const build =
    Platform.OS === 'ios'
      ? (config?.ios?.buildNumber ?? null)
      : Platform.OS === 'android'
        ? (config?.android?.versionCode?.toString() ?? null)
        : null;
  return {
    version: config?.version ?? null,
    build,
    runtime: typeof config?.runtimeVersion === 'string' ? config.runtimeVersion : null,
    platform: Platform.OS,
    osVersion: String(Platform.Version),
  };
}
