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

import {
  ApiError,
  listMedia,
  type MediaItem,
  type MontageTemplate,
  type MontageTemplateId,
} from '@/api';
import { useAuth } from '@/lib/auth';
import { formatRuntime } from '@/lib/dates';
import {
  ActionBar,
  Banner,
  Board,
  Button,
  ConfirmSheet,
  Icon,
  IconButton,
  Sheet,
  soften,
  Text,
  useReducedMotion,
  Waiting,
  WizardBar,
  type IconComponent,
} from '@/kit';
import { currentLanguage, useStrings } from '@/lib/language';
import { blankOrder, entered, enoughMaterial, fromTemplate, usable, type Order } from '@/lib/montage/order';
import { strings } from '@/strings';
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
 * selection already made; the api checks every named frame at the order anyway. It is read again
 * only when that ground is already known to have moved or never arrived: «Повторить» over a read
 * that failed — of the material, the range or the total — and a refusal of the total leading back
 * to a step (`reread`).
 */
export type Wizard = {
  id: string;
  /** null means «not read yet»: until it is, there is no step to draw and no count to draw it with. */
  items: MediaItem[] | null;
  /**
   * The material read again, from nothing: every step waits until it lands, and whatever was worked
   * out from the old read — step 4's range above all — is asked again off the new one.
   */
  reread: () => void;
  /** The `ready` half of them — the only frames an order can be made of. */
  material: MediaItem[];
  error: string | null;
  /** Too little to cut anything out of: `SheetTooLittle` stands in place of the whole wizard. */
  short: boolean;
  /**
   * The api's word that an order here would be refused for too little material (409), where the
   * count of frames cannot tell: three videos it never measured are three frames and no length.
   */
  tooLittle: () => void;
  order: Order;
  /** A patch, or one worked out from the order as it lands — for an answer that comes back late. */
  change: (patch: Partial<Order> | ((was: Order) => Partial<Order>)) => void;
  /** Out of the wizard with nothing ordered, from whichever step is on top. */
  leave: () => void;
  /** Which template is walking the wizard by itself right now, and null while nobody is. */
  auto: MontageTemplateId | null;
  /** Press a tile on `MontageTemplate`: the order is filled in and the steps walk themselves. */
  start: (template: MontageTemplate) => void;
  /** «Стоп», «Назад», «Отмена» — the walk ends where it stands and the wheel goes back. */
  stop: () => void;
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
 * The autopilot's own clock (spec 6, «Автопилот по шаблону»). Every step of the walk has the same
 * three beats — turn to it, fill it in, leave it standing — and the whole of it comes to about
 * eight seconds, which is what it is for: a person watching has to see *what* landed on a step
 * before the next one takes its place, and eight seconds of that is a thing being built rather
 * than a thing being waited for. It was under three, and three is a flicker (TASK-279).
 *
 * The one clock for both settings. «Reduce motion» takes away what moves — the typing, the tracks
 * arriving one by one, the figure travelling — and not the time to read: a step whose fields land
 * whole still needs its beat, or the story appears and is gone in the same instant.
 */
/** The step pushed and left alone until the stack has finished bringing it in (`duration.step`). */
export const ENTER_MS = 420;
/** One thing landing on a step: a track taken, the wish under the tracks. */
const FILL_MS = 360;
/** A full step left standing, so what landed on it is read before it turns over. */
export const READ_MS = 560;
/**
 * One stroke of the story — the journal's own beat, because it is the same hand writing in the same
 * app (`@/lib/montage/journal`) — and how many strokes the whole of it takes however long it is. Eighty
 * of them put a template's three hundred characters up over about two and a half seconds: fast
 * enough to read as writing, slow enough to watch the words arrive.
 */
const TYPE_MS = 30;
const TYPE_STROKES = 80;
/** How many moves the figure of the length takes to reach the template's: it travels, never jumps. */
const RIDE_STEPS = 24;

/**
 * The character of each of the six templates as a glyph (spec 5): it stands on the tile that
 * starts the order and on the plate over the story it wrote, and both have to be the same picture
 * for the plate to read as «this one». Kept here beside the rest of the wizard's shared parts and
 * not in `@/lib/montage/order`, which holds no values the phone has to load.
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

/** A refusal in the words a person reads, and the step that can take it back. */
export type Refusal = { text: string; back: 'frames' | 'length' | null };

/**
 * What a failed call of the wizard means to whoever is reading it, and which step can undo it —
 * always in the app's own words: the api writes its `error` in English, and a Russian screen with
 * an English line on it is the language falling off. What the api does say usefully is beside that
 * line, and a refusal is told apart by it (api README, the order's table of refusals): 409 with
 * `ready_items` is the material under the floor, a 400 with both edges of the range is a length the
 * frames no longer carry — said with those edges — and a 400 naming frames is frames no longer
 * there. A body this side does not know is the plain line about the answer: nothing a step here
 * could undo, and nothing it could say in the reader's language either.
 *
 * Read in the language of the moment, the way `@/api` words its own lines: it is called from inside
 * the answer to a call, where no `useStrings()` reaches.
 */
export function refusal(e: unknown): Refusal {
  const s = strings[currentLanguage()];
  if (!(e instanceof ApiError)) return { text: s.error.offline, back: null };
  const body = (
    typeof e.body === 'object' && e.body !== null ? e.body : {}
  ) as Record<string, unknown>;
  const { min_seconds: min, max_seconds: max } = body;
  if (e.status === 409 && 'ready_items' in body) return { text: s.montage.tooLittle, back: 'frames' };
  if (e.status === 403) return { text: s.montage.orderDenied, back: null };
  if (e.status === 400 && typeof min === 'number' && typeof max === 'number') {
    const [from, to] = [formatRuntime(min) ?? '', formatRuntime(max) ?? ''];
    return { text: s.montage.lengthOff(from, to), back: 'length' };
  }
  if (e.status === 400 && 'media_ids' in body) return { text: s.montage.framesGone, back: 'frames' };
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

  const change = useCallback(
    (patch: Partial<Order> | ((was: Order) => Partial<Order>)) =>
      setOrder((was) => ({ ...was, ...(typeof patch === 'function' ? patch(was) : patch) })),
    [],
  );

  /**
   * «Отмена» leaves the wizard and not the step: the steps are routes now, so the ones underneath
   * are dismissed first and the wizard itself goes after them. With nothing behind it at all — a
   * push or a link that opened the order cold — the memory is where it lands, which is where the
   * order was asked for.
   */
  const leave = useCallback(() => {
    router.dismissAll();
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/memory/[id]', params: { id } });
  }, [router, id]);

  /**
   * The autopilot (spec 6): which of the six is filling the wizard in, and null while the person
   * is driving. It lives up here with the answers for the same reason they do — a walk that pushes
   * a step is a walk that would be unmounted by its own step.
   */
  const [auto, setAuto] = useState<MontageTemplateId | null>(null);
  /**
   * Which walk is the current one. A `setTimeout` cannot be un-fired and a `push` already sent
   * cannot be recalled, so stopping is not cancelling anything: it moves this number on, and every
   * stroke of a walk asks first whether it is still the walk being made.
   */
  const flight = useRef(0);
  const reduced = useReducedMotion();

  const stop = useCallback(() => {
    flight.current += 1;
    setAuto(null);
  }, []);

  /**
   * One press on a tile, and the wizard does the rest: the order is filled in from the template
   * and the four steps walk past in front of whoever pressed it — the story typed, the tracks
   * arriving one by one, the length riding up to the template's — ending on the summary, where
   * the one button is theirs to press.
   *
   * Every field is filled on the step that asks for it and not all at once on the way in: the
   * point of the walk is that it can be watched, and «Стоп» leaves behind exactly what has
   * already landed. Which frames go in is the one thing a template says nothing about — the
   * automatic pass has had its say and step 1 is simply walked through.
   */
  const start = useCallback(
    (template: MontageTemplate) => {
      const fill = fromTemplate(template);
      flight.current += 1;
      const mine = flight.current;
      /** Waited, and still this walk? «Стоп», «Назад» and «Отмена» all answer no. */
      const going = async (ms: number) => {
        await new Promise((done) => setTimeout(done, ms));
        return flight.current === mine;
      };

      setAuto(template.id);
      // What the walk types in starts empty, so a walk stopped early leaves only what it wrote —
      // never an earlier template's words under this one's plate, or a hand's claim on them.
      change({ ...fill, story: '', tracks: [], note: '', seconds: null });

      void (async () => {
        // A template says nothing about which frames go in — the automatic pass has had its say —
        // so step 1 is only turned to and left standing: one beat to arrive, one to be read.
        router.push({ pathname: '/memory/[id]/order/frames', params: { id } });
        if (!(await going(ENTER_MS + READ_MS))) return;

        router.push({ pathname: '/memory/[id]/order/story', params: { id } });
        if (!(await going(ENTER_MS))) return;
        if (reduced) change({ story: fill.story });
        else {
          // Longer stories are typed in bigger strokes rather than over a longer time: a sentence
          // that takes fifteen seconds to appear is not being written, it is being withheld.
          const stroke = Math.max(1, Math.ceil(fill.story.length / TYPE_STROKES));
          for (let at = stroke; at < fill.story.length + stroke; at += stroke) {
            change({ story: fill.story.slice(0, at) });
            if (!(await going(TYPE_MS))) {
              // Stopped mid-word, the template's words land whole — unless a hand took the box.
              change((was) => (was.ownStory ? {} : { story: fill.story }));
              return;
            }
          }
        }
        if (!(await going(READ_MS))) return;

        router.push({ pathname: '/memory/[id]/order/music', params: { id } });
        if (!(await going(ENTER_MS))) return;
        if (reduced) change({ tracks: fill.tracks, note: fill.note });
        else {
          for (let n = 1; n <= fill.tracks.length; n += 1) {
            // The first track is «Без музыки» giving way to the list, and every one after it is a
            // row landing in it: both are the layout moving, so both are moved into.
            soften(FILL_MS);
            change({ tracks: fill.tracks.slice(0, n) });
            if (!(await going(FILL_MS))) return;
          }
          soften(FILL_MS);
          change({ note: fill.note });
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

        // And the walk ends on the total, with the wheel back in the person's hands: what the
        // autopilot put together is read there and spent by a press of theirs.
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
    [id, items, reread, material, error, short, tooLittle, order, change, leave, auto, start, stop],
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
 *
 * The bar wears three faces (spec 7.1, detail 3): the four numbered steps carry the scale, the way
 * in and the total drop it, and the total alone has nothing on its right — «Отмена» there would be
 * a second way out of a screen whose whole job is to be read and pressed once. While the autopilot
 * is walking, the step's own «Дальше» gives way to what it is doing and to «Стоп»; «Назад» and
 * «Отмена» stay where they are and stop it too, because a hand on either is a hand on the wheel.
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
  /**
   * Which of the four this is. `templates` is the way into the order and `summary` is the total;
   * neither is a step, so neither has a number or a place on the scale.
   */
  step: number | 'summary' | 'templates';
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
  const { items, reread, error, short, order, leave, auto, stop } = useOrder();
  const styles = useStyles();
  const summary = step === 'summary';
  /** A numbered step of the four, as against the two screens that only look like one. */
  const counted = typeof step === 'number';
  /** «Отмена» pressed over a walk that has something in it — asked before it is thrown away. */
  const [leaving, setLeaving] = useState(false);
  // The walk only ever pushes, so a step going away is somebody leaving it — the system's back
  // gesture, or the wizard itself closing — and a walk left running would push its next step onto
  // whatever is there now.
  useEffect(() => stop, [stop]);

  return (
    <Board>
      <WizardBar
        step={counted ? step : STEPS}
        steps={STEPS}
        label={
          counted
            ? s.montage.step(step, STEPS)
            : summary
              ? s.montage.summaryStep
              : s.montage.newOne
        }
        // The bar with no scale and the heading up against the row — what the total wears, and
        // what the way in wears too: there is no step under either of them to count.
        variant={counted ? 'step' : 'summary'}
        title={title}
        note={note}
        back={
          <IconButton
            icon={ChevronLeft}
            label={s.action.back}
            style={styles.back}
            // One step back, and out of the wizard from the first one — there is no step behind it.
            onPress={() => {
              stop();
              if (router.canGoBack()) router.back();
              else leave();
            }}
          />
        }
        cancel={
          summary ? undefined : (
            <Button
              variant="quiet"
              label={s.action.cancel}
              // Nothing said is nothing to lose: the wizard then closes on the press, the way it
              // always did. Asked here and not inside `leave()`, which is also what «Позже» on
              // `SheetTooLittle` presses — one sheet must never raise another.
              onPress={() => {
                stop();
                if (entered(order)) setLeaving(true);
                else leave();
              }}
            />
          )
        }
      />

      {error !== null ? (
        <Banner tone="error" text={error} style={styles.banner}>
          <Button size="xs" variant="quiet" label={s.action.retry} onPress={reread} />
        </Banner>
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

      {items === null || short ? null : auto !== null ? (
        /* Spec 6 — the autopilot's own bottom layer: nothing here is for pressing «Дальше» with,
           because nobody is being asked. The line says what is happening and the button is the
           way to take the wheel back on whichever step it is pressed. */
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
      ) : null}

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
