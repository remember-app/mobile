import { X } from 'lucide-react-native';
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { board, height, photo, radius, space, ThemePin, themed, type, useTheme } from '@/theme';

import { StepScale } from './bits';
import { BAR_GLYPH, Button, IconButton } from './button';
import { focusedField } from './field';
import type { IconComponent } from './icon';
import { DISMISS_KEYBOARD, FieldInBar, KEYBOARD_SCROLL } from './interaction';
import { useMeasured } from './sheet';
import { Text, useWordRoom, WordRoom } from './text';

/**
 * Spec 7.1 — the frame of a screen: the board it is drawn on, the bar at the top, the layer at the
 * bottom. The native header is off everywhere (`headerShown: false`), so a screen draws its own.
 */

export type BoardProps = {
  /** What stands at the top: the bar, and whatever the screen nails under it. */
  bar?: ReactNode;
  /** What stands at the bottom: the bottom layer, and whatever speaks over it. */
  footer?: ReactNode;
  /** The body's own column — its margins and gaps, where it holds what it has. */
  body?: StyleProp<ViewStyle>;
  /**
   * A body that is a list scrolls by itself, so it is drawn by the screen and handed `edges` to
   * put at its head and foot: the bar and the bottom layer once those scroll with it, nothing while
   * they stand. `children` is then what floats over the list — the glass, a sheet.
   */
  list?: (edges: { head: ReactNode; foot: ReactNode }) => ReactNode;
  /** The body — or, with a `list`, what floats over it. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The board (spec 7.1). Background `ink`, the device's status line left empty at the top, and the
 * body as its own layer between the bar and the bottom layer — the body is the only thing that
 * scrolls.
 *
 * The spec's 52 is the drawn phone's status bar; here the phone says how tall its own is, which is
 * the same thing measured rather than assumed.
 *
 * Every body scrolls once it outgrows the screen, and every screen stands on this board — so no
 * screen can forget to (TASK-372). The bar and the bottom layer stand still around it while they,
 * and one line of the body, fit the window; when they do not — the smallest phone at the largest
 * system type — the whole board scrolls as one, the way a sheet does (`pinnable` in `sheet.tsx`),
 * or the actions in them would stand past the edge with nothing to bring them back.
 *
 * The window decides for the bottom layer and not the room left over it: that room is what the
 * keyboard takes, and a field in the bottom layer moved into the scroll the moment the keyboard came
 * up for it is a field drawn anew — the keyboard goes down with it. A window of no height has not
 * been measured (off a phone), and stands as drawn.
 *
 * The keyboard is the board's to handle, once for every screen (TASK-377). Whatever stands at the
 * bottom rides up over it, the screen's action with it, and stays there whatever the type size. The
 * bar gives way instead (TASK-381): when the room the keyboard leaves over the bottom layer cannot
 * hold the bar and a line of the body — the smallest phone at the largest type, the wizard's heading
 * over a field — the bar goes into the scroll at the body's head, and the body stays where it was
 * on the screen; the bar is a scroll up. The field being typed into in the body is then brought into
 * what the keyboard left, whole where it fits. The body is never what moves, so a field in it is
 * never drawn anew; a bar holding a field of its own (`useFieldInBar`) stays put for the same
 * reason, and past it the top gives rather than the action — the board stands on its bottom edge.
 * The keyboard goes down the ordinary ways — a tap or a drag begun on anything that is not a field or
 * a button, a drag of the body ({@link KEYBOARD_SCROLL}, {@link DISMISS_KEYBOARD}) — and the bar
 * stands again.
 */
/** How far a field's box reaches past the input the keyboard is up for — its border and inner air. */
const FIELD_BOX = space.s3;

export function Board({ bar, footer, body, list, children, style }: BoardProps) {
  const insets = useSafeAreaInsets();
  const { fontScale, height: tall } = useWindowDimensions();
  const styles = useStyles();
  const [top, onTop] = useMeasured();
  const [foot, onFoot] = useMeasured();
  const [room, onRoom] = useMeasured();
  const [fields, setFields] = useState(0);
  const holdBar = useCallback(() => {
    setFields((n) => n + 1);
    return () => setFields((n) => n - 1);
  }, []);
  const line = type.body.lineHeight * fontScale;
  const pinned = tall === 0 || (bar ? top : 0) + (footer ? foot : 0) + line <= tall - insets.top;
  // The room is what is left over the bottom layer, wherever the bar stands, so moving the bar never
  // changes the answer that moved it. Not measured yet, it is nothing to go by.
  const stands = pinned && (room === 0 || fields > 0 || top + line <= room);

  const scroll = useRef<ScrollView>(null);
  const column = useRef<View>(null);
  const offset = useRef(0);
  const follow = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  };
  const to = (y: number) => {
    offset.current = Math.max(0, y);
    scroll.current?.scrollTo({ y: offset.current, animated: false });
  };
  const was = useRef({ stands, room });
  useLayoutEffect(() => {
    const before = was.current;
    was.current = { stands, room };
    // The bar in and out of the scroll's head while the bottom layer stands: the body keeps its
    // place on the screen. When the window moved both, the board starts from its top.
    if (before.stands !== stands && pinned) to(offset.current + (stands ? -top : top));
    // Less room — the keyboard has come up: the field being typed into in the body is brought
    // into what is left of it, box and all, or from its top where it is taller than that.
    const field = focusedField();
    if (room >= before.room || !field || !column.current) return;
    const sight = room - (stands ? top : 0);
    field.measureLayout(
      column.current,
      (_x, y, _w, h) => {
        const from = y + (stands ? 0 : top) - FIELD_BOX;
        const whole = h + FIELD_BOX * 2;
        if (from < offset.current || whole > sight) to(from);
        else if (from + whole > offset.current + sight) to(from + whole - sight);
      },
      () => {},
    );
  }, [stands, room, pinned, top]);

  const head = bar ? (
    <FieldInBar.Provider value={holdBar}>
      <View onLayout={onTop}>{bar}</View>
    </FieldInBar.Provider>
  ) : null;
  const tail = footer ? <View onLayout={onFoot}>{footer}</View> : null;

  return (
    // Android resizes the window for the keyboard itself; iOS needs telling. One of the two ways
    // and not both: a scroll that also moved its own insets for the keyboard would move twice.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.board, list ? null : styles.stands, { paddingTop: insets.top }, style]}
      {...DISMISS_KEYBOARD}
    >
      <View style={[styles.room, list ? null : styles.stands]} onLayout={onRoom}>
        {stands ? head : null}
        {list ? (
          <View style={styles.room}>
            {list({ head: stands ? null : head, foot: pinned ? null : tail })}
          </View>
        ) : (
          // A body that fits neither scrolls nor bounces.
          <ScrollView
            ref={scroll}
            style={styles.room}
            contentContainerStyle={styles.grow}
            alwaysBounceVertical={false}
            onScroll={follow}
            scrollEventThrottle={16}
            {...KEYBOARD_SCROLL}
          >
            {stands ? null : head}
            <View ref={column} style={[styles.grow, body]}>
              {children}
            </View>
            {pinned ? null : tail}
          </ScrollView>
        )}
      </View>
      {pinned ? tail : null}
      {list ? children : null}
    </KeyboardAvoidingView>
  );
}

/**
 * The bar at the top of a screen (spec 7.1), in the kinds that carry words:
 *
 * - **root** — the screen's own name in `displaySm` and one round button on the right;
 * - **inner** — a back button, the name in `barTitle`, truncated rather than wrapped;
 * - **inner with a subtitle** — a `meta` line under the name, the whole `Upload*` family;
 * - **inner with a right action** — the same plus a round button, or the «смотрят сейчас» pill;
 * - **inner with a quiet action** — a bare 44 whose glyph is `faint`, the way to something grave
 *   that is there without arguing with the name or with the screen's main button;
 * - **live** — the same two floors a shade smaller (17/21), because the bar over a montage on air
 *   carries a name, a line of meta and a pill of faces in one row.
 *
 * The other two kinds have components of their own: `WizardBar` and `ViewerBar`. The bar does not
 * scroll with the body, whichever it is, for as long as the board has room for it (`Board`).
 */
export function AppBar({
  title,
  subtitle,
  variant = 'inner',
  left,
  right,
  quiet,
  style,
}: {
  title: string;
  subtitle?: string;
  variant?: 'root' | 'inner' | 'live';
  left?: ReactNode;
  /** A round button, or the pill saying who is watching — it is a slot, not a kind. */
  right?: ReactNode;
  /** Spec 7.1 — the quiet action: «Удалить воспоминание» on `MemorySettings`. */
  quiet?: { icon: IconComponent; label: string; onPress: () => void; disabled?: boolean };
  style?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  // Spec 7.1: an inner bar closes to 8 and hangs its «Назад» 10 outside the screen's margin, so the
  // glyph inside it lines up with the words below rather than the button's own edge. On the right
  // only the quiet action is pulled, being as bare as «Назад»: the pill over a montage on air stands
  // on the margin, the way the layout has it. The root bar keeps 12 and its one button stays inside
  // the margin — it is filled, and a filled button pulled out would read as falling off the screen.
  const inner = variant !== 'root';

  return (
    <View style={[styles.bar, inner ? styles.barInner : null, style]}>
      {left ? <View style={inner ? styles.pullLeft : null}>{left}</View> : null}
      <View style={styles.barWords}>
        {/* With the native header off app-wide, this is the only thing left that can say «this is
            the top of the screen» to a rotor. `role` here is the typographic one — the spoken role
            is a separate prop. */}
        <Text
          accessibilityRole="header"
          role={variant === 'root' ? 'displaySm' : variant === 'live' ? 'barTitleLive' : 'barTitle'}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text role="meta" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {quiet ? <IconButton {...quiet} tint={color.faint} style={styles.pullRight} /> : null}
    </View>
  );
}

/**
 * Spec 7.1, detail 3: how far the system's type grows before «Отмена» stops being a word. The word
 * has 64 in its block — «Отмена» at 14 is 51.7, 62.0 at ×1.2 — so past this it is a round «x».
 */
export const CANCEL_WORD_SCALE = 1.2;

/**
 * The wizard's bar (spec 7.1, detail 3): a 74-wide block on each side so the step counter sits dead
 * centre whatever the words in those blocks are, the step scale under it, and the step's own heading
 * under that — the heading belongs to the bar and not to the body, because the body scrolls and this
 * does not, for as long as the board has room for it over the keyboard (`Board`).
 *
 * `summary` is the last face of it, the one the order's own total wears: no scale, because there is
 * no step after it, and the heading comes up to meet the row. `entry` is the first, the templates
 * of the way in: no scale either, and the heading 14 under the row (`MontageTemplate.html`), 2 lower
 * than the total's.
 *
 * «Отмена» is the bar's own to draw, because what it looks like depends on the type size and not on
 * the step: the word 14 / 600 up to ×1.2 of the system's type, and past that a round 44 with an «x»
 * that mirrors «Назад» and is still read out as the word. Both side blocks then close from 74 to 44,
 * on every face alike, so the counter stays dead centre and gets the room.
 */
export function WizardBar({
  step,
  steps,
  label,
  title,
  note,
  variant = 'step',
  back,
  cancel,
  style,
}: {
  step: number;
  steps: number;
  /** «Шаг 2 из 4», «Итог» — a sentence, so the screen writes it. */
  label: string;
  /** «Как собрать» — the step's own heading. */
  title?: string;
  /** The line under it, where a step needs one: «Без музыки или один-несколько треков.» */
  note?: string;
  variant?: 'step' | 'summary' | 'entry';
  back?: ReactNode;
  /** «Отмена» — its word, which a screen reader hears either way, and what it does. */
  cancel?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { color } = useTheme();
  const summary = variant === 'summary';
  const { fontScale } = useWindowDimensions();
  const glyph = fontScale > CANCEL_WORD_SCALE;
  const side = glyph ? styles.wizardSideNarrow : styles.wizardSide;

  return (
    <View style={style}>
      <View style={styles.bar}>
        <View style={side}>{back}</View>
        <Text role="label" tone="muted" style={styles.wizardStep}>
          {label}
        </Text>
        <View style={[side, styles.wizardRight]}>
          {cancel === undefined ? null : glyph ? (
            // «Назад»'s own 22 / 1.9, so it does not grow with the type — and `muted`, the word's
            // colour, where «Назад» on nothing is `paper` (spec 7.1, detail 3).
            <IconButton
              icon={X}
              label={cancel.label}
              glyph={BAR_GLYPH}
              tint={color.muted}
              onPress={cancel.onPress}
              style={styles.pullRight}
            />
          ) : (
            <Button
              variant="quiet"
              labelRole="controlSm"
              label={cancel.label}
              onPress={cancel.onPress}
              style={styles.cancelWord}
            />
          )}
        </View>
      </View>
      {/* Inside the screen's own margins, like everything else in a bar: the row above pads itself
          and the scale is its sibling, so without this it would run edge to edge under it. */}
      {variant === 'step' ? (
        <StepScale steps={steps} done={step} style={styles.wizardScale} />
      ) : null}
      {title ? (
        <View
          style={[
            styles.wizardWords,
            summary ? styles.wizardWordsUp : variant === 'entry' ? styles.wizardWordsEntry : null,
          ]}
        >
          <Text role="display" accessibilityRole="header">
            {title}
          </Text>
          {note ? (
            <Text role="note" tone="muted" style={styles.wizardNote}>
              {note}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The glass bar over a memory's feed (spec 7.1, detail 4) — the one that replaced the memory's tabs.
 * Three pieces of glass floating over the frames: a round 48 on each side and, between them, the
 * capsule carrying the memory's name and what it holds.
 *
 * The capsule is a button like the other two wherever it leads somewhere: in the feed it opens the
 * memory's settings, in picking mode it takes every frame. Given nothing to do — `Upload`, where it
 * only says which memory this material is going into — it is a plain plate and says so: a circle
 * that announces itself as a button and answers no tap is worse than one that never claimed to be.
 *
 * It wears no chevron either way (spec 1, rule 9): the capsule is a button by being the capsule,
 * and an arrow in it only takes room from the name. A long name is cut with an ellipsis and not
 * shrunk — the whole bar's rhythm hangs off that 14 (spec 10.6) — so the sentence a screen reader
 * gets is the caller's `capsuleLabel`, which carries the name in full either way.
 *
 * It draws its own darkening: 176 of gradient behind it, which is what keeps a white glyph readable
 * when the frame under the bar happens to be a white wall.
 */
export function GlassBar({
  title,
  meta,
  capsuleLabel,
  onCapsule,
  left,
  right,
  style,
}: {
  title: string;
  meta?: string;
  /** «Свадьба Лизы и Марка. Настройки воспоминания и люди» — the sentence, from the screen. */
  capsuleLabel: string;
  /** Left off, the capsule is a plate rather than a button — `Upload` is the one place it is. */
  onCapsule?: () => void;
  left?: ReactNode;
  /** Empty on `FramesEmpty`: with no frames there is nothing to pick. */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  // A plate and a button are the same capsule and the same two lines: only one of them is pressed.
  const words = (
    <>
      <Text role="pillTitle" numberOfLines={1}>
        {title}
      </Text>
      {meta ? (
        <Text role="meta" numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </>
  );

  return (
    // Glass is dark in both themes (spec 2), so everything drawn on it — the capsule's words and
    // the two round buttons a screen hands in — is read in the night's ink, whatever the app is in.
    <ThemePin value="dark">
      <View style={[styles.glassBar, { paddingTop: insets.top }, style]}>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              bottom: undefined,
              height: board.headGallery,
              experimental_backgroundImage: photo.headGallery,
            },
          ]}
        />
        {left}
        {onCapsule ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={capsuleLabel}
            onPress={onCapsule}
            style={styles.capsule}
          >
            {words}
          </Pressable>
        ) : (
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={capsuleLabel}
            style={styles.capsule}
          >
            {words}
          </View>
        )}
        {/* An empty slot still holds its 48 (`FramesEmpty`): the capsule stays in the middle of the
            bar instead of running to the edge and taking the name off-centre with it. */}
        {right ?? <View style={styles.slot} />}
      </View>
    </ThemePin>
  );
}

/**
 * The viewer's floating bar (spec 7.1, kind 5): three pieces of glass over the photograph — close
 * on the left, a pill carrying when and who in the middle, «ещё» on the right. It floats because
 * there is no surface under it; the frame is the surface. It keeps 12 at the sides and 10 between
 * the pieces, the same margin the glass bar over the feed keeps and not the screen's 16.
 */
export function ViewerBar({
  date,
  meta,
  label,
  onPress,
  left,
  right,
  style,
}: {
  date: string;
  meta: string;
  /**
   * The whole pill read out in one sentence — «Сведения о кадре: 13 сентября, 21:47 · Марк
   * Ковалёв». Only where the pill leads somewhere: a pill that is not a button is two lines of
   * words and is read as such.
   */
  label?: string;
  onPress?: () => void;
  left?: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();

  return (
    // Over a photograph in both themes, like the glass bar: the round buttons a screen hands in are
    // read in the night's ink whatever the app is in.
    <ThemePin value="dark">
      <View style={[styles.viewerBar, style]}>
        {left}
        <View style={styles.viewerMiddle}>
          {/* Spec 7.1, detail 5: the pill is a button — the road to the frame's own sheet — and says
              so by being the pill, with no chevron (spec 1, rule 9). A `Pressable` with nothing to
              press stays a plain block of glass. */}
          <Pressable
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={onPress ? label : undefined}
            onPress={onPress}
            disabled={!onPress}
            style={styles.viewerPill}
          >
            {/* The date in the pinned night's `paper`, #F5F3EE — not the photograph's white. */}
            <Text role="row" numberOfLines={1}>
              {date}
            </Text>
            <Text role="meta" numberOfLines={1} style={styles.viewerMeta}>
              {meta}
            </Text>
          </Pressable>
        </View>
        {right}
      </View>
    </ThemePin>
  );
}

/**
 * How deep the gradient under the bottom layer runs, and what it is made of (spec 2 and 7.1). Two
 * of them fade the screen's own `ink` upwards; two lie over photographs instead — the gallery's wall
 * of frames and the queue on `Upload` — and those stay dark in daylight for the same reason a cover's
 * darkening does.
 */
export type Footer = 'plain' | 'count' | 'gallery' | 'upload';

const FOOTERS: Record<Footer, { height: number; over?: string; stop: string }> = {
  plain: { height: board.footer, stop: '58%' },
  count: { height: board.footerTall, stop: '62%' },
  gallery: { height: board.footerGallery, over: photo.footerGallery, stop: '' },
  upload: { height: board.footerUpload, over: photo.footerUpload, stop: '' },
};

/**
 * The bottom layer (spec 7.1): a gradient footer fading up into the screen, and the screen's action
 * standing on it 30 from the bottom. The gradient never catches a press — the buttons over it do.
 *
 * Four depths, because what the footer has to hide differs: 132 under one button, 176 when a line of
 * counting stands over it, 190 over the gallery, 210 over the sending queue. The row itself takes
 * whatever it is given — one button, two stacked — so a kind of bottom layer is never a flag here.
 *
 * Three across (`start`, the action, `end` — the round 56 either side of it at the foot of the
 * gallery) is one row while the action's words fit whole between the two; once one of them breaks
 * mid-word — the smallest phone on large type — the round two stand in a row of their own over the
 * action, and it takes the whole width (`useWordRoom`, TASK-375).
 *
 * `experimental_backgroundImage` and not a gradient library: React Native takes the spec's own CSS
 * string, the same way `boxShadow` already does.
 */
export function ActionBar({
  children,
  start,
  end,
  above,
  footer,
  style,
}: {
  children: ReactNode;
  /** The round one at the left end of the action's row — the filters, «Поделиться». */
  start?: ReactNode;
  /** And at its right end — the arrangement, «Удалить». */
  end?: ReactNode;
  /** «Выбрано 12 из 61» and a quiet «Снять» — spec 7.1, kind 3. */
  above?: ReactNode;
  /** Left off: 176 when something stands above the button, 132 when nothing does. */
  footer?: Footer;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const styles = useStyles();
  const { roomy, room } = useWordRoom();
  const kind = FOOTERS[footer ?? (above ? 'count' : 'plain')];
  const sides = start !== undefined || end !== undefined;

  return (
    <View style={[styles.layer, { paddingBottom: Math.max(insets.bottom, board.bottom) }, style]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            top: undefined,
            height: kind.height,
            experimental_backgroundImage:
              kind.over ?? `linear-gradient(to top, ${color.ink} ${kind.stop}, transparent)`,
          },
        ]}
      />
      {above ? <View style={styles.layerAbove}>{above}</View> : null}
      {sides && roomy ? (
        <View style={styles.layerSides}>
          {start}
          {end}
        </View>
      ) : null}
      <WordRoom.Provider value={sides ? room : null}>
        <View style={styles.layerRow}>
          {sides && !roomy ? start : null}
          {children}
          {sides && !roomy ? end : null}
        </View>
      </WordRoom.Provider>
    </View>
  );
}

/**
 * How far the plain bottom layer's gradient reaches above its action block (spec 4): the layer of
 * the body ends where that gradient begins, `board.footer` over the bottom edge, while the board's
 * body ends at the block itself — the button 12 under the gradient's top, at least 30 off the edge.
 * A screen centring an empty state or a spinner in its body hands this back at the body's foot:
 * `HomeEmpty`, `HomeLoading` (114…712), `InviteDead` (0…712). Reckoned at the button's own 56.
 */
export function useFooterOverhang(): number {
  const insets = useSafeAreaInsets();
  return Math.max(
    0,
    board.footer - space.s3 - height.primary - Math.max(insets.bottom, board.bottom),
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    board: { flex: 1, backgroundColor: color.ink },
    // What fits changes nothing; what does not is let go at the top, never at the bottom — the
    // bottom layer is the screen's action, and it has to stay over the keyboard.
    stands: { justifyContent: 'flex-end' },
    room: { flex: 1 },
    grow: { flexGrow: 1 },
    bar: {
      minHeight: height.bar,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
    },
    barInner: { gap: space.s2 },
    pullLeft: { marginLeft: -10 },
    pullRight: { marginRight: -10 },
    // `flex: 1` with `minWidth: 0` is what makes a long name truncate instead of pushing the button
    // on the right off the screen.
    barWords: { flex: 1, minWidth: 0, gap: 2 },
    // Spec 7.1: the glass bar keeps 12 on each side instead of the screen's 16 — the two round
    // buttons are glass and float, and glass hung on the margin reads as stuck to the edge.
    glassBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s3,
    },
    capsule: {
      flex: 1,
      minWidth: 0,
      height: height.roundViewer,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: space.s4,
      borderRadius: radius.pill,
      backgroundColor: photo.bar,
      borderWidth: 1,
      borderColor: photo.barEdge,
    },
    slot: { width: height.roundViewer },
    wizardScale: { marginHorizontal: space.s4, marginTop: space.s3 },
    // Spec 7.1: 18 under the scale, and 12 where there is no scale to stand under — 14 on the way in.
    wizardWords: { marginHorizontal: space.s4, marginTop: 18 },
    wizardWordsUp: { marginTop: space.s3 },
    wizardWordsEntry: { marginTop: 14 },
    wizardNote: { marginTop: 10 },
    wizardSide: { width: 74, alignItems: 'flex-start' },
    wizardSideNarrow: { width: height.roundBar, alignItems: 'flex-start' },
    wizardRight: { alignItems: 'flex-end' },
    // Spec 7.1, detail 3: 10 a side and hung 10 past the margin, which leaves the word 64 of its 74.
    cancelWord: { paddingHorizontal: 10, marginRight: -10 },
    wizardStep: { flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
    viewerBar: {
      minHeight: height.roundViewer,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: space.s3,
    },
    // The pill is as wide as its words and stands in the middle of what the two buttons leave —
    // it is not a strip laid across the bar. The hairline is the layout's, and only the pill has it.
    viewerMiddle: { flex: 1, minWidth: 0, alignItems: 'center' },
    // Two floors, centred by the same 20 on both sides; a long name is cut, never the pill widened.
    viewerPill: {
      height: height.roundViewer,
      maxWidth: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
      paddingHorizontal: 20,
      borderRadius: radius.pill,
      backgroundColor: photo.glass,
      borderWidth: 1,
      borderColor: photo.barEdge,
    },
    viewerMeta: { color: photo.viewerMeta },
    layer: { paddingHorizontal: space.s4, paddingTop: space.s3, gap: space.s3 },
    // «Выбрано 12 из 61» and a quiet «Снять»: the button moves under the words when the type is too
    // large for both on one line.
    layerAbove: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s3 },
    // Three across at the foot of the gallery: 56 · 226 · 56 with 10 between (`MemoryFrames`).
    layerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    // The same two round ones over an action that needed the whole width, at the two ends of it.
    layerSides: { flexDirection: 'row', justifyContent: 'space-between' },
  }),
);
