import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { Button, ChipTemplate, TextArea } from '@/kit';
import { useStrings } from '@/lib/language';
import { STORY_LIMIT } from '@/lib/montage/order';
import { TEMPLATE_SIGN, useOrder, WizardStep } from '@/screens/order/wizard';
import { space, themed, wizardLead } from '@/theme';
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
      body={styles.body}
    >
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

      <TextArea
        label={s.montage.storyLabel}
        labelHidden
        limit={STORY_LIMIT}
        state={order.story.length >= STORY_LIMIT ? 'error' : undefined}
        placeholder={s.montage.storyPlaceholder}
        value={order.story}
        onChangeText={(story) => {
          stop();
          change({ story, ownStory: true });
        }}
      />
    </WizardStep>
  );
}
const useStyles = themed(() =>
  StyleSheet.create({
    body: {
      flexGrow: 1,
      paddingHorizontal: space.s4,
      paddingTop: wizardLead.note,
      paddingBottom: space.s6,
      gap: 10,
    },
  }),
);
