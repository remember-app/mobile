import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'simple_push',
        gestureEnabled: true,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
