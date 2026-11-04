import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError, listMontageTemplates, type MontageTemplate } from '@/api';
import { Banner, Button, DRAWN, TileTemplate, Waiting } from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatRuntime } from '@/lib/dates';
import { useStrings } from '@/lib/language';
import { blankOrder, RATIO } from '@/lib/montage/order';
import { refusal, TEMPLATE_SIGN, useOrder, useStillHere, WizardStep } from '@/screens/order/wizard';
import { space, themed, wizardLead } from '@/theme';
export default function TemplatesScreen() {
  const router = useRouter();
  const s = useStrings();
  const { token } = useAuth();
  const { id, material, change, auto, start, stop, tooLittle } = useOrder();
  const styles = useStyles();
  const gone = useStillHere();
  const [templates, setTemplates] = useState<MontageTemplate[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [again, setAgain] = useState(0);
  useEffect(() => {
    if (!token) return;
    listMontageTemplates(token, id).then(
      (came) => {
        if (!gone.current) setTemplates(came);
      },
      (e: unknown) => {
        if (gone.current) return;
        if (e instanceof ApiError && e.status === 409) tooLittle();
        else setNotice(refusal(e).text);
      },
    );
  }, [token, id, again, tooLittle]);
  return (
    <WizardStep
      step="templates"
      title={s.montage.templateTitle}
      note={s.montage.templateHint}
      action={
        <Button
          variant="secondary"
          wide
          icon={DRAWN.pen}
          glyph={{ size: 17, stroke: 1.8 }}
          label={s.montage.ownSetup}
          onPress={() => {
            stop();
            change(blankOrder());
            router.push({ pathname: '/memory/[id]/order/frames', params: { id } });
          }}
        />
      }
      body={notice === null && templates !== null ? styles.body : undefined}
    >
      {notice !== null ? (
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
        <View style={styles.grid}>
          {templates.map((one, i) => (
            <TileTemplate
              key={one.id}
              title={s.montage.template[one.id]}
              note={s.montage.templateNote[one.id]}
              spec={`${formatRuntime(one.target_seconds) ?? ''} · ${RATIO[one.orientation]}`}
              icon={TEMPLATE_SIGN[one.id]}
              uri={material[i]?.thumbnail_url ?? undefined}
              picked={auto === one.id}
              dimmed={auto !== null && auto !== one.id}
              onPress={() => start(one)}
              style={styles.cell}
            />
          ))}
        </View>
      )}
    </WizardStep>
  );
}
const useStyles = themed(() =>
  StyleSheet.create({
    middle: { flexGrow: 1, justifyContent: 'center' },
    banner: { marginHorizontal: space.s4 },
    body: {
      flexGrow: 1,
      paddingHorizontal: space.s4,
      paddingTop: wizardLead.note,
      paddingBottom: space.s6,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
    cell: { flexGrow: 1, width: '40%' },
  }),
);
