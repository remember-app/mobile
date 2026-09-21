import { useRouter } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { errorMessage, listMontageTemplates, type MontageTemplate } from '@/api';
import { useAuth } from '@/auth';
import { formatRuntime } from '@/dates';
import { Banner, Button, TileTemplate, Waiting } from '@/kit';
import { useStrings } from '@/language';
import { blankOrder, RATIO } from '@/montage';
import { TEMPLATE_SIGN, useOrder, useStillHere, WizardStep } from '@/order-wizard';
import { space, themed } from '@/theme';

/**
 * `MontageTemplate` (spec 8) — the way into an order and the biggest decision in it: six
 * ready-made films, and pressing one is the whole order made. The autopilot then fills the four
 * steps in and walks them in front of whoever pressed it (`@/order-wizard`), so this screen's
 * work ends at the press.
 *
 * What is on a tile comes from two places on purpose: the name and the line under it are the
 * app's own words, because they are a character and not a fact, and «3:00 · 16:9» is the api's —
 * the length is already held inside what this memory's material can carry, and the shape is what
 * the worker will actually cut onto. Nothing here is worked out on the phone.
 *
 * «Настроить самому» is the other door and leads to the same four steps with nothing filled in:
 * a walk abandoned half way through a template must not leave its story in the box of somebody
 * who then said they would do it themselves.
 *
 * Too little material is answered above this screen rather than on it — `SheetTooLittle` stands
 * in place of the body the moment the gallery is read, so no tile can be pressed into an order
 * the api would refuse.
 */
export default function TemplatesScreen() {
  const router = useRouter();
  const s = useStrings();
  const { token } = useAuth();
  const { id, material, change, auto, start, stop } = useOrder();
  const styles = useStyles();
  const gone = useStillHere();
  /** The six, in the api's own order — null until it has answered, because there is no guess. */
  const [templates, setTemplates] = useState<MontageTemplate[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Bumped by «Повторить»: the read is the effect, so asking again is asking it again. */
  const [again, setAgain] = useState(0);
  /** Two to a row, worked out the way both galleries work theirs out (`memory/frames.tsx`). */
  const { width } = useWindowDimensions();
  const cell = { width: (width - space.s4 * 2 - space.s2) / 2 };

  useEffect(() => {
    if (!token) return;
    listMontageTemplates(token, id).then(
      (came) => {
        if (!gone.current) setTemplates(came);
      },
      (e: unknown) => {
        if (!gone.current) setNotice(errorMessage(e));
      },
    );
  }, [token, id, again]);

  return (
    <WizardStep
      step="templates"
      title={s.montage.templateTitle}
      note={s.montage.templateHint}
      action={
        <Button
          variant="secondary"
          wide
          icon={Pencil}
          label={s.montage.ownSetup}
          // Blank, and every field of it: a template pressed before this and then abandoned would
          // otherwise walk into the steps as somebody's own answers.
          onPress={() => {
            stop();
            change(blankOrder());
            router.push({ pathname: '/memory/[id]/order/frames', params: { id } });
          }}
        />
      }
    >
      {notice !== null ? (
        // The six could not be read. Said with the way to ask again under it — and the door
        // beside it stays open: an order can be walked by hand without a single template.
        <Banner tone="error" text={notice} style={styles.banner}>
          <Button
            size="xs"
            variant="quiet"
            label={s.action.retry}
            onPress={() => {
              setNotice(null);
              setAgain((n) => n + 1);
            }}
          />
        </Banner>
      ) : templates === null ? (
        <View style={styles.middle}>
          <Waiting text={s.state.loading} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.grid}>
            {templates.map((one, i) => (
              <TileTemplate
                key={one.id}
                title={s.montage.template[one.id]}
                note={s.montage.templateNote[one.id]}
                spec={`${formatRuntime(one.target_seconds) ?? ''} · ${RATIO[one.orientation]}`}
                icon={TEMPLATE_SIGN[one.id]}
                // A frame of this memory's own behind each one — the mood of the film and not its
                // subject, which is why the kit keeps it well under the words.
                uri={material[i]?.thumbnail_url ?? undefined}
                // Taken by the autopilot: this one is ringed and the other five go down.
                picked={auto === one.id}
                dimmed={auto !== null && auto !== one.id}
                onPress={() => start(one)}
                style={cell}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </WizardStep>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    middle: { flex: 1, justifyContent: 'center' },
    banner: { marginHorizontal: space.s4 },
    body: { flexGrow: 1, paddingHorizontal: space.s4, paddingBottom: space.s6 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  }),
);
