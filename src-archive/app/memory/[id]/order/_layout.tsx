import { Stack, useLocalSearchParams } from 'expo-router';
import { useReducedMotion } from '@/kit';
import { OrderProvider } from '@/screens/order/wizard';
import { duration } from '@/theme';
export default function OrderLayout() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();
  const reduced = useReducedMotion();
  return (
    <OrderProvider id={id}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reduced ? 'none' : 'slide_from_right',
          animationDuration: duration.step,
        }}
      />
    </OrderProvider>
  );
}
