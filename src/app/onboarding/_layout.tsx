import { Stack } from 'expo-router';

import { useTheme } from '@/ui/theme';

export default function OnboardingLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'simple_push',
        gestureEnabled: true,
        contentStyle: { backgroundColor: theme.color.ink },
      }}
    />
  );
}
