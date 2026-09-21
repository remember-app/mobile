import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  FileText,
  Film,
  Heart,
  Home,
  Plus,
  Smartphone,
  Sun,
  Zap,
} from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage, listMedia, type MediaItem, type MontageTemplateId } from '@/api';
import { useAuth } from '@/auth';
import {
  ActionBar,
  Banner,
  Board,
  Button,
  ConfirmSheet,
  Icon,
  IconButton,
  Sheet,
  Text,
  Waiting,
  WizardBar,
  type IconComponent,
} from '@/kit';
import { useStrings } from '@/language';
import { blankOrder, entered, enoughMaterial, usable, type Order } from '@/montage';
import { radius, space, themed, useTheme } from '@/theme';

/**
 * The frame every step of the order stands in (spec 8, «Ролик: заказ по шагам»): what the wizard
 * has been told so far, the material it is being told about, and the shell each step draws itself
 * inside.
 *
 * One step is one route under `app/memory/[id]/order/` and the whole of the wizard is this file
 * plus those — which is the reason it exists at all. The answers cannot live in a step, because a
 * step is unmounted the moment the next one is pushed; they live in the layout above all of them,
 * and a step reads them with `useOrder()`. Adding a step is adding a file and touching nothing:
 * neither the layout, which declares no screens by name, nor any other step.
 *
 * The material is read once, here, on the way into the wizard — deliberately not on every focus
 * the way the three faces of a memory read themselves. An order is a decision taken about the
 * material as it stands, and a re-read landing between two steps would move the ground under a
 * selection already made; the api checks every named frame at the order anyway.
 */
export type Wizard = {
  id: string;
  /** null means «not read yet»: until it is, there is no step to draw and no count to draw it with. */
  items: MediaItem[] | null;
  /** The `ready` half of them — the only frames an order can be made of. */
  material: MediaItem[];
  error: string | null;
  /** Too little to cut anything out of: `SheetTooLittle` stands in place of the whole wizard. */
  short: boolean;
  order: Order;
  change: (patch: Partial<Order>) => void;
  /** Out of the wizard with nothing ordered, from whichever step is on top. */
  leave: () => void;
};

const Held = createContext<Wizard | null>(null);

export function useOrder(): Wizard {
  const held = useContext(Held);
  if (!held) throw new Error('A step of the order stands outside the wizard.');
  return held;
}

/** Four steps, and the scale under every bar counts the same four. */
export const STEPS = 4;

/**
 * The character of each of the six templates as a glyph (spec 5): it stands on the tile that
 * starts the order and on the plate over the story it wrote, and both have to be the same picture
 * for the plate to read as «this one». Kept here beside the rest of the wizard's shared parts and
 * not in `@/montage`, which holds no values the phone has to load.
 */
export const TEMPLATE_SIGN: Record<MontageTemplateId, IconComponent> = {
  for_myself: Heart,
  quick: Zap,
  report: FileText,
  short_form: Smartphone,
  parents: Home,
  dopamine: Sun,
};

/**
 * Whether the screen that made a call is still here when the answer lands. `useRouter` hands back
 * the app's own router and not the screen's, so a call still in flight when somebody pressed
 * «Отмена» — or took the back gesture — would otherwise move the app under whoever is on top now
 * (found in review, m-23). Reset on the way in as well as set on the way out: a remount is a
 * screen that is here again.
 */
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

export function OrderProvider({ id, children }: { id: string; children: ReactNode }) {
  const { token } = useAuth();
  const router = useRouter();
  const s = useStrings();
  const { color } = useTheme();
  const styles = useStyles();

  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order>(blankOrder);

  useEffect(() => {
    if (!token) return;
    listMedia(token, id).then(setItems, (e: unknown) => setError(errorMessage(e)));
  }, [token, id]);

  const change = useCallback(
    (patch: Partial<Order>) => setOrder((was) => ({ ...was, ...patch })),
    [],
  );

  /**
   * «Отмена» leaves the wizard and not the step: the steps are routes now, so the ones underneath
   * are dismissed first and the wizard itself goes after them. With nothing behind it at all — a
   * push or a link that opened the order cold — the movies face of the memory is where it lands,
   * which is where the order was asked for.
   */
  const leave = useCallback(() => {
    router.dismissAll();
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/memory/[id]', params: { id, face: 'films' } });
  }, [router, id]);

  const material = useMemo(() => usable(items ?? []), [items]);
  const short = items !== null && !enoughMaterial(items);
  const held = useMemo(
    () => ({ id, items, material, error, short, order, change, leave }),
    [id, items, material, error, short, order, change, leave],
  );

  return (
    <Held.Provider value={held}>
      {children}

      {/* Spec 8: raised in place of step 1, because an order that cannot go through is not a wizard
          to walk. Cancelling it — the handle, the darkness, «Позже» — leaves the whole screen. */}
      <Sheet
        visible={short}
        onCancel={leave}
        narrow
        // The sign and the heading stand on one line here, which is why the heading is drawn inside
        // the head row rather than handed over as `title` — the sheet stacks those two.
        head={
          <View style={styles.headLine}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.sign}
            >
              <Icon icon={Film} size={26} color={color.muted} />
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
            <Button variant="quiet" wide label={s.montage.later} onPress={leave} />
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

/**
 * One step of the wizard, as every step of it looks: the bar with «Шаг N из 4», the scale, the
 * step's own heading, whatever stands under the heading out of the scroll, the body, and the one
 * button on the bottom layer.
 *
 * Everything that is the same on all four lives here and not in the steps — the way out, the way
 * back, the waiting while the gallery is read, the line that says the read failed, and the silence
 * while `SheetTooLittle` is up. A step is then its own body and its own button, which is the whole
 * of what makes it that step.
 */
export function WizardStep({
  step,
  title,
  note,
  head,
  notice,
  above,
  action,
  children,
}: {
  /** Which of the four this is — `summary` is the total, which has no number and no scale. */
  step: number | 'summary';
  title: string;
  /** The line under the heading: «Можно пропустить — тогда режиссёр решит сам». */
  note?: string;
  /** What stands between the heading and the body, out of the scroll — a count, a way into a sheet. */
  head?: ReactNode;
  /** What this step has to say about a call of its own that failed. */
  notice?: string | null;
  /** The line over the button — «Оставьте хотя бы 3 кадра». */
  above?: ReactNode;
  /** The one button of the step. Left out while there is nothing yet to press it about. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const s = useStrings();
  const { items, error, short, order, leave } = useOrder();
  const styles = useStyles();
  const summary = step === 'summary';
  /** «Отмена» pressed over a walk that has something in it — asked before it is thrown away. */
  const [leaving, setLeaving] = useState(false);

  return (
    <Board>
      <WizardBar
        step={summary ? STEPS : step}
        steps={STEPS}
        label={summary ? s.montage.summaryStep : s.montage.step(step as number, STEPS)}
        variant={summary ? 'summary' : 'step'}
        title={title}
        note={note}
        back={
          <IconButton
            icon={ChevronLeft}
            label={s.action.back}
            style={styles.back}
            // One step back, and out of the wizard from the first one — there is no step behind it.
            onPress={() => (router.canGoBack() ? router.back() : leave())}
          />
        }
        cancel={
          <Button
            variant="quiet"
            label={s.action.cancel}
            // Nothing said is nothing to lose: the wizard then closes on the press, the way it
            // always did. Asked here and not inside `leave()`, which is also what «Позже» on
            // `SheetTooLittle` presses — one sheet must never raise another.
            onPress={() => (entered(order) ? setLeaving(true) : leave())}
          />
        }
      />

      {error !== null ? (
        <Banner tone="error" text={error} style={styles.banner} />
      ) : items === null ? (
        <View style={styles.middle}>
          <Waiting text={s.state.loading} />
        </View>
      ) : short ? null : (
        <>
          {head ? <View style={styles.head}>{head}</View> : null}
          {children}
        </>
      )}

      {/* Above the bar and outside the body, the way every face of a memory holds its own: what the
          button below answers with must not land at the bottom of something that has scrolled. */}
      {notice ? <Banner text={notice} style={styles.banner} /> : null}

      {items === null || short || !action ? null : (
        <ActionBar above={above}>{action}</ActionBar>
      )}

      {/* Spec 7.1, detail 8 — the gentle kind: nothing here is destroyed, but four steps of
          choices are, and that is what the sheet names. Drawn by the shell so «Отмена» asks the
          same question on whichever step it is pressed. */}
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
    // Spec 7.1: the wizard's back button hangs 10 past the screen's margin, as every «Назад» does.
    back: { marginLeft: -10 },
    banner: { marginHorizontal: space.s4, marginBottom: space.s3 },
    middle: { flex: 1, justifyContent: 'center' },
    // The bar's own heading is over this, so it stands as close under it as the layout draws it.
    head: { paddingHorizontal: space.s4, paddingTop: 10, paddingBottom: space.s4 },
    headLine: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    // Spec 8, `SheetTooLittle`: the 56 square with the montage sign over the heading.
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
