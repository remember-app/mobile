import { StyleSheet, View } from 'react-native';

import { PhotoStack, Text } from '@/kit';
import { useStrings } from '@/lib/language';
import { space } from '@/theme';

// Relative and not through `@/assets`, which only the typecheck knows about: this path resolves the
// same for Metro on a phone and for vite in a test, and nothing here is worth an alias.
//
// ponytail: these three are the layout's own placeholders — generated blurs, not photographs
// (design/README.md). They are what the onboarding stack has until real art exists; every other
// picture in the product is a frame somebody brought, and onboarding stands before there are any.
import left from '../../../assets/images/onboarding/left.jpg';
import middle from '../../../assets/images/onboarding/middle.jpg';
import right from '../../../assets/images/onboarding/right.jpg';

/** Left, centre, right — the order `PhotoStack` lays them in, the middle one on top. */
const FRAMES = [left, middle, right];

/**
 * The head of the onboarding screens (spec 8, «Онбординг»): the stack of frames, the product's own
 * name, and the one line that says what it is all for.
 *
 * One element and not four copies of a layout. It stands in exactly the same place on `Login`,
 * `LoginEmail`, `LoginCode` and `Username` — anchored to the top of the board rather than centred
 * in what is left over — so that walking the way in moves only the block at the bottom of the
 * screen and never the name above it. A head centred in the free room would drift up and down as
 * the footer under it grew a field, then six cells, and that drift is the one thing these four
 * screens must not do.
 *
 * `small` is `Consent` and nothing else: a shorter stack, a narrower hero and its own line, because
 * a card of three promises has to fit underneath.
 */
export function OnboardingHead({ small }: { small?: boolean }) {
  const s = useStrings();

  return (
    <View style={[styles.head, small ? styles.headSmall : null]}>
      <PhotoStack photos={FRAMES} small={small} />
      <View style={[styles.words, small ? styles.wordsSmall : null]}>
        {/* The product's name, and not a word either language owns (TASK-77) — so it is written
            here rather than asked of the dictionary. */}
        <Text accessibilityRole="header" role={small ? 'heroNarrow' : 'hero'} style={styles.centre}>
          Remember
        </Text>
        <Text role={small ? 'bodySm' : 'body'} tone="muted" style={styles.centre}>
          {small ? s.consent.lead : s.login.promise}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Spec 8, `Login`: the stack opens 16 under the device's own status line, the name stands 26 under
  // the stack and the promise 14 under the name.
  head: { alignItems: 'center', paddingTop: space.s4, gap: 26 },
  // `Consent`: the squeezed stack's box starts 12 above the status line — nothing of it is drawn in
  // those 12, its highest corner is just under the line — and the name follows 18 below it.
  headSmall: { paddingTop: 0, marginTop: -12, gap: 18 },
  words: { alignItems: 'center', gap: 14, paddingHorizontal: space.s6 },
  wordsSmall: { gap: space.s3 },
  centre: { textAlign: 'center' },
});
