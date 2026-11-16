import { Stack } from 'expo-router';

import { ScreenSkin } from '@/ui/kit/backdrop';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'simple_push',
        gestureEnabled: true,
        contentStyle: { backgroundColor: 'transparent' },
      }}
      screenLayout={({ route, children }) => (
        <ScreenSkin routeName={route.name}>{children}</ScreenSkin>
      )}
    />
  );
}
