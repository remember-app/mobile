import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { ScrollView, StyleSheet } from 'react-native';

import { Button, ChipTemplate, TextArea } from '@/kit';
import { useStrings } from '@/lib/language';
import { STORY_LIMIT } from '@/lib/montage/order';
import { TEMPLATE_SIGN, useOrder, WizardStep } from '@/screens/order/wizard';
import { space, themed } from '@/theme';

/**
 * Step 2, `MontageStory` — how to cut this one, in the organizer's own words. The text is almost
 * the whole screen and nothing on it is required: left empty, the director decides, and the button
 * says «Дальше» either way.
 *
 * A template started the order with its own text in the box, and the plate over it says which one.
 * The moment those words are edited they stop being the template's — the plate then says «Свой
 * текст», because a template whose text was rewritten is no longer the thing it names. Nothing
 * else about the order changes with it: the length, the shape and the music it filled in are the
 * order's own now, exactly as if they had been chosen by hand.
 */
export default function StoryStep() {
  const router = useRouter();
  const s = useStrings();
  const { id, order, change, stop } = useOrder();
  const styles = useStyles();
  const template = order.template;

  return (
    <WizardStep
      step={2}
      title={s.montage.storyTitle}
      note={s.montage.storyHint}
      action={
        <Button
          variant="primary"
          wide
          trailingIcon={ChevronRight}
          label={s.montage.next}
          onPress={() => router.push({ pathname: '/memory/[id]/order/music', params: { id } })}
        />
      }
    >
      <ScrollView contentContainerStyle={styles.body}>
        {template ? (
          <ChipTemplate
            icon={order.ownStory ? undefined : TEMPLATE_SIGN[template]}
            label={
              order.ownStory
                ? s.montage.ownText
                : s.montage.fromTemplate(s.montage.template[template])
            }
          />
        ) : null}

        {/* The screen's own heading is this box's label, so the label itself is only spoken. */}
        <TextArea
          label={s.montage.storyLabel}
          labelHidden
          limit={STORY_LIMIT}
          placeholder={s.montage.storyPlaceholder}
          value={order.story}
          // Typing into the box while the template types is taking the wheel: the walk stops
          // rather than writing over the hand.
          onChangeText={(story) => {
            stop();
            change({ story, ownStory: true });
          }}
        />
      </ScrollView>
    </WizardStep>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    body: { flexGrow: 1, paddingHorizontal: space.s4, paddingBottom: space.s6, gap: 10 },
  }),
);
