import { useRouter } from 'expo-router';
import { PanelsTopLeft, Plus, Smartphone, Sun } from 'lucide-react-native';
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import {
  ApiError,
  listMedia,
  type MediaItem,
  type MontageTemplate,
  type MontageTemplateId,
} from '@/api';
import {
  ActionBar,
  BackButton,
  Banner,
  Board,
  type BoardProps,
  Button,
  ConfirmSheet,
  DRAWN,
  Icon,
  type IconComponent,
  Sheet,
  soften,
  Text,
  useReducedMotion,
  Waiting,
  WizardBar,
  WizardHeading,
} from '@/kit';
import { useAuth } from '@/lib/auth';
import { formatRuntime } from '@/lib/dates';
import { currentLanguage, useStrings } from '@/lib/language';
import {
  blankOrder,
  enoughMaterial,
  entered,
  fromTemplate,
  type Order,
  usable,
} from '@/lib/montage/order';
import { strings } from '@/strings';
import { radius, space, themed, useTheme } from '@/theme';
export type Wizard = {
  id: string;
  items: MediaItem[] | null;
  reread: () => void;
  refresh: () => Promise<MediaItem[] | null>;
  material: MediaItem[];
  error: string | null;
  short: boolean;
  tooLittle: () => void;
  order: Order;
  change: (patch: Partial<Order> | ((was: Order) => Partial<Order>)) => void;
  leave: () => void;
  auto: MontageTemplateId | null;
  start: (template: MontageTemplate) => void;
  stop: () => void;
};
const Held = createContext<Wizard | null>(null);
export function useOrder(): Wizard {
  const held = useContext(Held);
  if (!held) throw new Error('A step of the order stands outside the wizard.');
  return held;
}
export const STEPS = 4;
export const ENTER_MS = 420;
const FILL_MS = 360;
export const READ_MS = 560;
const TYPE_MS = 30;
const TYPE_STROKES = 80;
const RIDE_STEPS = 24;
export const TEMPLATE_SIGN: Record<MontageTemplateId, IconComponent> = {
  for_myself: DRAWN.heart,
  quick: DRAWN.zap,
  report: DRAWN.fileText,
  short_form: Smartphone,
  parents: DRAWN.house,
  dopamine: Sun,
};
export function useStillHere(): RefObject<boolean> {
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);
  return gone;
}
export type Refusal = {
  text: string;
  back: 'frames' | 'length' | null;
};
export function refusal(e: unknown): Refusal {
  const s = strings[currentLanguage()];
  if (!(e instanceof ApiError)) return { text: s.error.offline, back: null };
  const body = (typeof e.body === 'object' && e.body !== null ? e.body : {}) as Record<
    string,
    unknown
  >;
  const { min_seconds: min, max_seconds: max } = body;
  if (e.status === 409 && 'ready_items' in body)
    return { text: s.montage.tooLittle, back: 'frames' };
  if (e.status === 403) return { text: s.montage.orderDenied, back: null };
  if (e.status === 400 && typeof min === 'number' && typeof max === 'number') {
    const [from, to] = [formatRuntime(min) ?? '', formatRuntime(max) ?? ''];
    return { text: s.montage.lengthOff(from, to), back: 'length' };
  }
  if (e.status === 400 && 'media_ids' in body)
    return { text: s.montage.framesGone, back: 'frames' };
  return { text: e.status === 429 ? s.error.tooMany : s.error.status(e.status), back: null };
}
export function OrderProvider({ id, children }: { id: string; children: ReactNode }) {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const { color } = useTheme();
  const styles = useStyles();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order>(blankOrder);
  const reread = useCallback(() => {
    if (!token) return;
    setItems(null);
    setError(null);
    listMedia(token, id).then(setItems, (e: unknown) => setError(refusal(e).text));
  }, [token, id]);
  useEffect(reread, [reread]);
  const refresh = useCallback(async (): Promise<MediaItem[] | null> => {
    if (!token) return null;
    try {
      const next = await listMedia(token, id);
      setItems(next);
      return next;
    } catch {
      return null;
    }
  }, [token, id]);
  const change = useCallback(
    (patch: Partial<Order> | ((was: Order) => Partial<Order>)) =>
      setOrder((was) => ({ ...was, ...(typeof patch === 'function' ? patch(was) : patch) })),
    [],
  );
  const leave = useCallback(() => {
    router.dismissAll();
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/memory/[id]', params: { id } });
  }, [router, id]);
  const [auto, setAuto] = useState<MontageTemplateId | null>(null);
  const flight = useRef(0);
  const reduced = useReducedMotion();
  const stop = useCallback(() => {
    flight.current += 1;
    setAuto(null);
  }, []);
  const start = useCallback(
    (template: MontageTemplate) => {
      const fill = fromTemplate(template);
      flight.current += 1;
      const mine = flight.current;
      const going = async (ms: number) => {
        await new Promise((done) => setTimeout(done, ms));
        return flight.current === mine;
      };
      setAuto(template.id);
      change({ ...fill, story: '', tracks: [], seconds: null });
      void (async () => {
        router.push({ pathname: '/memory/[id]/order/frames', params: { id } });
        if (!(await going(ENTER_MS + READ_MS))) return;
        router.push({ pathname: '/memory/[id]/order/story', params: { id } });
        if (!(await going(ENTER_MS))) return;
        if (reduced) change({ story: fill.story });
        else {
          const stroke = Math.max(1, Math.ceil(fill.story.length / TYPE_STROKES));
          for (let at = stroke; at < fill.story.length + stroke; at += stroke) {
            change({ story: fill.story.slice(0, at) });
            if (!(await going(TYPE_MS))) {
              change((was) => (was.ownStory ? {} : { story: fill.story }));
              return;
            }
          }
        }
        if (!(await going(READ_MS))) return;
        router.push({ pathname: '/memory/[id]/order/music', params: { id } });
        if (!(await going(ENTER_MS))) return;
        if (reduced) change({ tracks: fill.tracks });
        else {
          for (let n = 1; n <= fill.tracks.length; n += 1) {
            soften(FILL_MS);
            change({ tracks: fill.tracks.slice(0, n) });
            if (!(await going(FILL_MS))) return;
          }
        }
        if (!(await going(READ_MS))) return;
        router.push({ pathname: '/memory/[id]/order/build', params: { id } });
        if (!(await going(ENTER_MS))) return;
        if (reduced) change({ seconds: fill.seconds });
        else {
          for (let n = 1; n <= RIDE_STEPS; n += 1) {
            change({ seconds: Math.round((fill.seconds * n) / RIDE_STEPS) });
            if (!(await going(TYPE_MS))) return;
          }
        }
        if (!(await going(READ_MS))) return;
        router.push({ pathname: '/memory/[id]/order/summary', params: { id } });
        setAuto(null);
      })();
    },
    [change, id, reduced, router],
  );
  const [refused, setRefused] = useState(false);
  const tooLittle = useCallback(() => setRefused(true), []);
  const material = useMemo(() => usable(items ?? []), [items]);
  const short = items !== null && (refused || !enoughMaterial(items));
  const held = useMemo(
    () => ({
      id,
      items,
      reread,
      refresh,
      material,
      error,
      short,
      tooLittle,
      order,
      change,
      leave,
      auto,
      start,
      stop,
    }),
    [
      id,
      items,
      reread,
      refresh,
      material,
      error,
      short,
      tooLittle,
      order,
      change,
      leave,
      auto,
      start,
      stop,
    ],
  );
  return (
    <Held.Provider value={held}>
      {children}

      <Sheet
        visible={short}
        onCancel={leave}
        head={
          <View style={styles.headLine}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.sign}
            >
              <Icon icon={PanelsTopLeft} size={26} color={color.muted} />
            </View>
            <Text role="sheetTitleSm" accessibilityRole="header" style={styles.grow}>
              {s.montage.tooLittleTitle}
            </Text>
          </View>
        }
        footer={
          <>
            <Button
              variant="primary"
              icon={Plus}
              label={s.gallery.add}
              onPress={() => router.replace({ pathname: '/memory/[id]/upload', params: { id } })}
            />
            <Button variant="quiet" size="ms" wide label={s.montage.later} onPress={leave} />
          </>
        }
      >
        <Text role="bodySm" tone="muted">
          {s.montage.tooLittleText(material.length)}
        </Text>
      </Sheet>
    </Held.Provider>
  );
}
export function WizardStep({
  step,
  title,
  named,
  note,
  head,
  notice,
  above,
  action,
  body,
  list,
  children,
}: {
  step: number | 'summary' | 'templates';
  title?: string;
  named?: ReactNode;
  note?: string;
  head?: ReactNode;
  notice?: string | null;
  above?: ReactNode;
  action?: ReactNode;
  body?: StyleProp<ViewStyle>;
  list?: BoardProps['list'];
  children?: ReactNode;
}) {
  const router = useRouter();
  const s = useStrings();
  const { items, reread, error, short, order, leave, auto, stop } = useOrder();
  const styles = useStyles();
  const summary = step === 'summary';
  const counted = typeof step === 'number';
  const face = counted ? 'step' : summary ? 'summary' : 'entry';
  const [leaving, setLeaving] = useState(false);
  useEffect(() => stop, [stop]);
  const ready = error === null && items !== null && !short;
  const bottom =
    items === null || short ? null : auto !== null ? (
      <ActionBar
        above={
          <Text role="meta" tone="muted">
            {s.montage.autoGoing}
          </Text>
        }
      >
        <Button variant="secondary" wide label={s.montage.autoStop} onPress={stop} />
      </ActionBar>
    ) : action ? (
      <ActionBar above={above}>{action}</ActionBar>
    ) : null;
  return (
    <Board
      bar={
        <WizardBar
          step={counted ? step : STEPS}
          steps={STEPS}
          label={
            counted
              ? s.montage.step(step, STEPS)
              : summary
                ? s.montage.summaryTitle
                : s.montage.newOne
          }
          variant={face}
          back={
            <BackButton
              label={s.action.back}
              style={styles.back}
              onPress={() => {
                stop();
                if (router.canGoBack()) router.back();
                else leave();
              }}
            />
          }
          cancel={
            summary
              ? undefined
              : {
                  label: s.action.cancel,
                  onPress: () => {
                    stop();
                    if (entered(order)) setLeaving(true);
                    else leave();
                  },
                }
          }
        />
      }
      heading={
        <>
          {title === undefined ? named : <WizardHeading title={title} note={note} variant={face} />}
          {ready && head ? <View style={styles.head}>{head}</View> : null}
        </>
      }
      footer={
        notice || bottom ? (
          <>
            {notice ? <Banner text={notice} style={styles.banner} /> : null}
            {bottom}
          </>
        ) : undefined
      }
      body={ready ? body : null}
      list={ready ? list : undefined}
    >
      {error !== null ? (
        <Banner tone="error" text={error} style={styles.banner}>
          <Button size="xs" variant="quiet" label={s.action.retry} onPress={reread} />
        </Banner>
      ) : items === null ? (
        <View style={styles.middle}>
          <Waiting text={s.state.loading} />
        </View>
      ) : ready ? (
        children
      ) : null}

      <ConfirmSheet
        visible={leaving}
        variant="gentle"
        title={s.montage.leaveAsk}
        text={s.montage.leaveText}
        confirmLabel={s.montage.leaveDo}
        cancelLabel={s.montage.stay}
        onConfirm={() => {
          setLeaving(false);
          leave();
        }}
        onCancel={() => setLeaving(false)}
      />
    </Board>
  );
}
const useStyles = themed(({ color }) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    back: { marginLeft: -10 },
    banner: { marginHorizontal: space.s4, marginBottom: space.s3 },
    middle: { flexGrow: 1, justifyContent: 'center' },
    head: { paddingHorizontal: space.s4, paddingTop: 10, paddingBottom: space.s5 },
    headLine: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    sign: {
      width: 56,
      height: 56,
      borderRadius: radius.cell,
      backgroundColor: color.raise,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
