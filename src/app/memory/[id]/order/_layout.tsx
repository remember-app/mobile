import { Stack, useLocalSearchParams } from 'expo-router';

import { OrderProvider } from '@/order-wizard';

/**
 * Ordering a movie, in the steps spec 8 lays out. One route per step under this folder, and this
 * is what holds them together: the answers given so far and the material they are about live here,
 * above every step, so walking back and forth between them loses nothing.
 *
 * Why steps are routes and not a number in one screen's state: the back gesture then belongs to
 * the step, as a person expects it to, and — the reason it was done — the steps stop being one
 * file. A screen added to this wizard is a file added to this folder; no screen is declared by
 * name here, so nothing above it is edited either.
 *
 * Nothing is sent until the last button of the last step: the wizard is one decision with one way
 * out. What comes of a finished order is not the list the organizer came from but the waiting over
 * the one montage they just asked for.
 */
export default function OrderLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <OrderProvider id={id}>
      {/* No native header on any of them, by the same rule the root stack keeps: every screen here
          draws the kit's own wizard bar. */}
      <Stack screenOptions={{ headerShown: false }} />
    </OrderProvider>
  );
}
