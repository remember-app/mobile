import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { readLanguage } from '@/functionality/settings/language';
import { applyLanguage } from '@/ui/i18n';

export default function RootLayout() {
  useEffect(() => {
    void readLanguage().then(applyLanguage);
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
