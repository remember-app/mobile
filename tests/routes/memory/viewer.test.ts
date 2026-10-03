/**
 * The window one frame opens in (spec 7.4, `Viewer` / `ViewerVideo`, TASK-211): three buttons on
 * glass, the strip under the picture, the sheet of what the server knows about the shot, and what a
 * finger does to any of it.
 *
 * Their text and not their rendered output, because this file has no renderer: every test here runs
 * pure logic, and a screen would need `react-native` transformed and `expo-router`, `expo-video` and
 * the safe area all faked before its first line ran. What is worth pinning about a reorganisation is
 * the shape of it — that much the text answers. What these screens *do* is read in the flow tests
 * (`tests/screens/`), where there is a renderer; what stays here is what only the text can say:
 * where a thing stands, and what is no longer in the file.
 */

import { expect, test } from 'vitest';
import layout from '@/app/_layout.tsx?raw';
import home from '@/app/index.tsx?raw';
// The viewer's strip is the library's own part, and what it does with a finger was learned three
// times over on a real phone — so it is read here, beside the window that mounts it.
import bars from '@/kit/bars.tsx?raw';
import filmstrip from '@/kit/filmstrip.tsx?raw';
import films from '@/screens/memory/films.tsx?raw';
import info from '@/screens/memory/frame-info.tsx?raw';
import viewer from '@/screens/memory/frame-viewer.tsx?raw';
import frames from '@/screens/memory/frames.tsx?raw';
import material from '@/screens/memory/frames-material.ts?raw';
import sheets from '@/screens/memory/frames-sheets.tsx?raw';
import { en, ru } from '@/strings';
import { photo } from '@/theme';

test('the material of a memory has one name — on the card, on the switch, over the sheet', () => {
  // «N frames» on the card, «Photos and videos (N)» on the guest list, «Gallery» over the contact
  // sheet was the report (TASK-76). One key answers all of them, and it is the heading over the
  // material on the feed.
  expect(frames).toContain('title={s.memory.framesPlain}');
  expect(home).toContain('s.home.noFrames');
  for (const set of [en, ru]) {
    // «1 кадр» → «кадр», which is what «Ни одного кадра — скиньте первые» (spec 7.6, detail 37) is
    // built on too. Russian declines it, so the word is held by its stem, the singular.
    expect(set.home.noFrames.toLowerCase()).toContain(set.memory.frames(1).split(' ')[1]);
  }
});

/**
 * The open frame (TASK-147, rebuilt to the «Афиша» layout in TASK-211): `Viewer`, `ViewerVideo`,
 * `SheetFrame` and `SheetFrameInfo` of spec 8, in a file of their own — «во весь экран, без кнопок
 * снизу, а снизу лента» is what was asked for, and a shape is what these pin. What the strip does
 * with a finger lives in the library now and is read there; everything the gallery decides about a
 * record is pinned in `tests/lib/frames.test.ts`.
 */

test('the whole window is three buttons on glass, and under the picture only the strip', () => {
  // Spec 8, `Viewer`: «сверху три стеклянные кнопки … снизу плёнка 48», and nothing else. The row
  // of four round buttons that used to stand under the strip is gone with the layout that had it —
  // what was in it is the menu the «⋯» drops and the sheet the pill raises.
  expect(viewer).toContain('<ViewerBar');
  expect(viewer).not.toContain('<ActionBar');
  expect(viewer).not.toContain('styles.actions');
  // TASK-109's darkening under the bar went with the bar it was under — the glass carries the three
  // buttons now. The two darkenings over the picture that the four `Viewer*` layouts draw are a
  // different thing and are pinned on their own below: they are gradients off `photo`, and the
  // window writes no gradient string of its own.
  expect(viewer).not.toContain('linear-gradient');
  expect(viewer).toContain('experimental_backgroundImage: photo.viewerShadeTop');
  // The order down the window, spec 8: the scrubber on a line of its own, then the strip, and the
  // strip is the last thing in the window.
  const strip = viewer.indexOf('<Filmstrip');
  expect(viewer.indexOf('<VideoTrack')).toBeLessThan(strip);
  expect(strip).toBeLessThan(viewer.indexOf('<ActionMenu'));
  // And since TASK-478 one more thing stands inside the window: the frame's own screen, under the
  // picture and not over it. It is the last of the three, and it takes what the frame gave up.
  expect(viewer.indexOf('<FrameInfoPanel')).toBeLessThan(viewer.indexOf('</ThemePin>'));
  expect(viewer).toContain('style={{ height: screen - room }}');
  // The three of them, each in its own place: «Назад» on the left, the pill of when and who in the
  // middle, «⋯» on the right — and no fourth.
  const bar = viewer.slice(viewer.indexOf('<ViewerBar'), viewer.indexOf('styles.tools,'));
  expect(bar.slice(bar.indexOf('left={'))).toContain('label={s.action.close}');
  expect(bar.slice(bar.indexOf('right={'))).toContain('label={s.viewer.more}');
  expect(bar).toContain('s.viewer.details');
  // …and while the panel stands the same pill says the other thing, and the window hands it the
  // held-in state the layout draws it in.
  expect(bar).toContain('s.viewer.hideDetails');
  expect(bar).toContain('on={details}');
  expect(bar.match(/<IconButton/g)).toHaveLength(2);
});

test('the pill of when and who is the road to the frame’s own screen, and the same pill closes it', () => {
  // Spec 8: «капсула с датой и „время · автор“», and it leads to `FrameInfo` — which since TASK-478
  // is a screen standing under the picture and not a sheet over it, so it is mounted by being
  // opened and there is one button both ways. The stamp is the gallery's own reading of when a
  // frame happened — the same one its heading in the feed is under — and never the memory's span,
  // which is what the pill used to carry.
  expect(viewer).toContain('const stamp = new Date(shotAt(item));');
  expect(viewer).toContain('const when = formatDayShort(stamp);');
  expect(viewer).toContain("const meta = [formatTime(stamp), who].filter(Boolean).join(' · ');");
  expect(viewer).toContain('onPress={toggleDetails}');
  // One piece of state behind it, and the read behind that belongs to the panel: it asks on being
  // mounted, so the window carries no read of its own and an answer that lands after the panel was
  // shut has nothing to land in.
  expect(viewer).toContain('setDetails((was) => !was)');
  expect(viewer).not.toContain('fetchFrameInfo');
  expect(viewer).toContain('{details ? (');
  // The frame gives up the top of the window for it — the layout's 352 upright, and less on a phone
  // lying on its side, which has a fraction of that height to divide (`frameInfoRoom`).
  expect(viewer).toContain('const room = details ? frameInfoRoom(screen) : screen;');
  expect(viewer).toContain('const box = frameBox(item.width, item.height, width, room);');
  expect(ru.viewer.details).toBe('Сведения о кадре');
  expect(ru.viewer.hideDetails).toBe('Скрыть сведения');
});

test('the «⋯» drops the glass menu of the three errands, and stays lit under it', () => {
  // Spec 7.1, detail 9: the menu falls out of the button rather than rising from the bottom, the
  // button it fell out of stays visible and lit, and the dangerous line is cut off from the two
  // above it. «Удалить» deletes nothing itself — it hands the window to the sheet that names the
  // price, exactly as the old sheet did.
  const menu = viewer.slice(viewer.indexOf('<ActionMenu'), viewer.indexOf('</ActionMenu>'));
  const order = [
    'label={s.action.share}',
    'label={s.viewer.saveToPhone}',
    'label={s.viewer.remove}',
  ].map((label) => menu.indexOf(label));
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(order[0]).toBeGreaterThan(-1);
  expect(menu).toContain('gapBefore={2}');
  expect(menu.replace(/\s+/g, ' ')).toContain(
    'danger onPress={() => { setMenu(false); setConfirming(true); }}',
  );
  expect(viewer).toContain('style={menu ? styles.held : null}');
  expect(viewer).toContain('held: { backgroundColor: photo.held }');
  // The words are the layout's own, and the delete is the only red line in the menu.
  expect(ru.viewer.remove).toBe('Удалить из воспоминания');
  expect(ru.viewer.saveToPhone).toBe('Сохранить на телефон');
});

test('nobody who may not delete is shown a delete, greyed or otherwise', () => {
  // The line is absent for them rather than disabled — it was so in the sheet this menu replaced,
  // and the api is the authority either way: the face decides ownership, the window draws it.
  const menu = viewer.slice(viewer.indexOf('<ActionMenu'), viewer.indexOf('</ActionMenu>'));
  expect(menu).toContain('{mayDelete(item) ? (');
  expect(menu).toContain('  ) : null}');
});

test('the frame’s own screen is who, when, what and where — and draws nothing it was not told', () => {
  // Spec 8, `FrameInfo` since TASK-478. It carries no head of its own: the frame it is about is
  // still on the screen above it, and the bar over that says when it was shot and who brought it.
  // Everything else arrives with one read, which the panel asks for itself on being mounted.
  // The panel is handed the record and nothing else: no thumbnail and no head of its own (the
  // delete confirmation further down is a sheet, and a sheet may show the frame it is about).
  const raised = viewer.slice(
    viewer.indexOf('<FrameInfoPanel'),
    viewer.indexOf('/>', viewer.indexOf('<FrameInfoPanel')),
  );
  expect(raised).toContain('item={item}');
  expect(raised).not.toContain('thumb=');
  expect(raised).not.toContain('meta={[formatWeekday(stamp)');
  expect(viewer).toContain('<FrameInfoPanel');
  expect(viewer).toContain('memoryId={memoryId}');
  expect(viewer).toContain('item={item}');
  expect(viewer).toContain('onFilm={openFilm}');
  const panel = info.slice(info.indexOf('export function FrameInfoPanel'));
  expect(panel).toContain('fetchFrameInfo(token, memoryId, item.id)');
  // Who brought it and how much they brought in all, then the summary rows, then the movies.
  expect(panel).toContain(
    's.viewer.brought(formatDayShort(info.created_at), info.uploaded_by.media_count)',
  );
  expect(panel.indexOf('frameFacts(info, s, undefined, place)')).toBeLessThan(
    panel.indexOf('s.viewer.inFilms'),
  );
  // The place is the name the phone's geocoder gives the frame's point, asked for by the panel
  // itself (`@/lib/geocoder`) — the api sends coordinates only.
  expect(panel).toContain('usePlaceName(info?.latitude, info?.longitude)');
  // A frame in no movie at all loses the block, not just its rows.
  expect(panel).toContain('{info.montages.length === 0 ? null : (');
  expect(ru.viewer.brought('15 сентября', 96)).toBe('принёс 15 сентября · всего 96 кадров');
});

test('the boxes this frame lies in are chips, and the rules on them are the server’s own', () => {
  // Spec 10.8.2, detail 18 — the labels are shown and filed from the frame's own screen. The order
  // is the api's (shared first, by title) and is not sorted again here: the filter over the gallery
  // reads the same order, and a second sort would show the picker a different one.
  const panel = info.slice(info.indexOf('export function FrameInfoPanel'));
  expect(panel).toContain('info.labels.map((label)');
  expect(panel).not.toContain('.sort(');
  // An empty array is a frame in no box: the block is gone rather than empty, and it is
  // `labels.length` that asks — the api never sends a null here (TASK-479).
  expect(panel).toContain('{info.labels.length === 0 ? null : (');
  // Shared wears the box's own colour and a private one a lock, the two marks the sheet uses.
  expect(panel).toContain('swatch={labelTint(label.color, theme)}');
  expect(panel).toContain('icon={label.shared ? undefined : Lock}');
  // Who may file is the api's own answer about the asker, never worked out on the phone: a chip
  // the server will not let this person file into has no press at all.
  expect(panel).toContain('onPress={label.can_add_media ? () => void takeOut(label) : undefined}');
  // And the dashed one opens the sheet that already exists, over this one frame.
  expect(panel).toContain('<LabelSheets');
  expect(panel).toContain('frames={marked}');
  expect(ru.labels.putInto).toBe('Положить в лейбл');
  expect(ru.labels.takeOut('Лучшее')).toBe('Убрать кадр из «Лучшее»');
});

test('a movie the frame stands in is named by its length and opens the one player there is', () => {
  const panel = info.slice(info.indexOf('export function FrameInfoPanel'));
  // «Ролик на 1:00» out of the length, because a montage has no name until templates arrive; the
  // second it stands at is the right-hand half of the same row (spec 7.7, detail 62).
  expect(panel).toContain('title={runtime ? s.montage.ofLength(runtime) : s.montage.count(1)}');
  expect(panel).toContain("at={s.viewer.at(formatRuntime(film.start_seconds) ?? '')}");
  expect(ru.viewer.at('1:12')).toBe('на 1:12');
  expect(ru.montage.ofLength('1:00')).toBe('Ролик на 1:00');
  // One frame may stand in one montage twice — the api's own key is the pair, and so is this one.
  expect(panel).toContain('key={`${film.id}:${film.start_seconds}`}');
  // And the row opens the player the movies face already has: no second player is drawn for a
  // frame (chief, 21.09.2026). The ask is set on the screen this window is a part of — a push to
  // the same route would stack a second feed of the memory under the film — and only once the
  // window is gone: the player is a `Modal` too, and iOS swallows one raised while another is still
  // being dismissed. So the window is shut and not unmounted, says when it is gone, and Android,
  // which has no such event, goes on at once.
  const shut = viewer.replace(/\s+/g, ' ');
  expect(shut).toContain(
    "function openFilm(montageId: string) { setDetails(false); setFilm(montageId); if (Platform.OS !== 'ios') raiseFilm(montageId); }",
  );
  expect(shut).toContain(
    'function raiseFilm(montageId: string) { onClose(); router.setParams({ montage: montageId }); }',
  );
  expect(shut).toContain('visible={film === null}');
  expect(shut).toContain('onDismiss={() => { if (film !== null) raiseFilm(film); }}');
  expect(films).toContain(
    'const { montage: asked } = useLocalSearchParams<{ montage?: string }>();',
  );
  // The block is already mounted when the ask arrives, so it follows the parameter rather than
  // reading it once as it mounts — and spends it, or the switch back onto this face would raise
  // the player again and the same film could not be asked for twice.
  const ask = films.replace(/\s+/g, ' ');
  expect(ask).toContain('useState<string | null>(null)');
  expect(ask).toContain(
    "useEffect(() => { if (!asked) return; setPlaying(asked); router.setParams({ montage: '' }); }, [asked, router]);",
  );
});

test('a frame that would not open says so, and the strip stays where it is', () => {
  // Spec 8, the edge of `Viewer`: «знак image и „Кадр не открылся“, плёнка остаётся». The sign is
  // inside the frame's own box, so everything under it — the scrubber, the strip — is untouched.
  const stage = viewer.slice(viewer.indexOf('<View style={[styles.big, box, styles.blank]}>'));
  expect(stage).toContain('<Empty icon={ImageSign} text={s.viewer.notOpened} />');
  expect(viewer.indexOf('styles.blank')).toBeLessThan(viewer.indexOf('<Filmstrip'));
  expect(ru.viewer.notOpened).toBe('Кадр не открылся');
});

test('the window is a dark room, and only the sheet over it is in the theme the app is in', () => {
  // The window itself is pinned dark in both themes — the layout gives it a background darker than
  // `ink` on purpose. Inside that pin stand the menu and the frame's own screen: both are the
  // window itself, one glass over the photograph and one the bottom of it, so neither answers to
  // the app's theme. The delete sheet is outside it, because a sheet is its own surface and daylight
  // has to reach it (спека 2, «день подстановкой»). Nothing names a colour of its own: every one of
  // them is a token.
  expect(viewer).toContain('<ThemePin value="dark">');
  // Spec 8, `Viewer`: «фон #08080C», deeper than `ink` — the frame hangs in black.
  expect(viewer).toContain('viewer: { flex: 1, backgroundColor: photo.viewer }');
  expect(photo.viewer).toBe('#08080C');
  const pinned = viewer.indexOf('</ThemePin>');
  expect(viewer.indexOf('<ActionMenu')).toBeLessThan(pinned);
  expect(viewer.indexOf('<FrameInfoPanel')).toBeLessThan(pinned);
  expect(pinned).toBeLessThan(viewer.indexOf('<ConfirmSheet'));
  for (const file of [viewer, sheets, info])
    expect(file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});

test('a video carries a transport and a photo carries none of it', () => {
  // `ViewerVideo` is the same window plus three things (spec 8): the 72 button in the middle of the
  // picture, the scrubber on a line of its own over the strip, and the sound. All three hang on the
  // same question — whether there is a playable file — so a photograph cannot grow half a transport.
  for (const part of [
    '<VideoTrack',
    'icon={isPlaying ? Pause : Play}',
    'icon={isMuted ? VolumeX : Volume2}',
  ]) {
    expect(viewer).toContain(part);
  }
  // Two branches and not three: the button shares the picture's own box, so it comes and goes with
  // it (TASK-181). The scrubber is the other one.
  expect(viewer.match(/playable !== null \? \(/g)).toHaveLength(2);
  // And the platform's own transport is off: this window draws its own, and two sets of controls
  // over one video is what the layout is written against.
  expect(viewer).toContain('nativeControls={false}');
  // The length is the api's first — known before a byte of the file arrives — and the player's only
  // as the fallback for a record that came without one.
  expect(viewer).toContain('const runs = item.duration_seconds ?? player.duration;');
  // And what the transport shows is read off the player, with the events only asking for a redraw:
  // `useEvent` keeps the last payload it was handed even once the player under it has been replaced,
  // so walking from one video to the next would otherwise draw the one before it.
  expect(viewer).toContain('const isPlaying = player.playing;');
  expect(viewer).toContain('const at = player.currentTime;');
});

test('the 72 stands in the middle of the picture, on the dark the layout puts under it', () => {
  // Reported off a device (TASK-181): the button hung visibly above the middle of the frame, because
  // it was centred over the whole stage, whose top padding is the floating bar's own 116.
  const stage = viewer.slice(viewer.indexOf('{playable !== null ? ('), viewer.indexOf('{notice ?'));
  // One box holds the picture and the button, and it is the frame's own box — hung on the stage
  // instead, the button would centre itself over whatever the stage has left over rather than over
  // the frame. That is what the middle of the one being the middle of the other means (TASK-475).
  expect(stage).toContain('<View style={[styles.big, box]}>');
  expect(stage.indexOf('<VideoView')).toBeLessThan(stage.indexOf('styles.middleOfFrame'));
  // The box is the frame's own proportions and the video is covered into it, like a photograph.
  expect(viewer).toContain('const box = frameBox(item.width, item.height, width, room);');
  expect(stage).toContain('contentFit="cover"');
  expect(viewer).toContain('...StyleSheet.absoluteFill,');
  // 72 on the kit's «над видео» (spec 7.2, 10.10): `rgba(6,6,10,.5)`, no hairline, the glyph filled
  // in `paper` — not the viewer's glass, which vanishes over a bright frame, and not the tile's 72 %
  // mark. The tone picks the glyph's colour; nothing here overrides it with a white of its own.
  const button = stage.slice(stage.indexOf('<IconButton'));
  const pause = button.slice(0, button.indexOf('/>'));
  expect(pause).toContain('size={72}');
  expect(pause).toContain('tone="video"');
  expect(pause).not.toContain('tint=');
  expect(viewer).not.toContain('photo.mark');
});

test('the strip lies over the picture, and a video’s scrubber 14 above it', () => {
  // Spec 8, `ViewerVideo`, and 10.10: 14 — not 12 — from the scrubber down to the strip. What that
  // 14 was measured against is gone (TASK-475): the picture used to be laid out above the tools and
  // had room reserved under it (a photograph 96, a video 140). It is now drawn in a box of its own
  // proportions in the middle of the phone, and the tools lie over it — so the only gap left is the
  // one between a video's own two rows, and the window takes it.
  expect(viewer).toContain("tools: { position: 'absolute', left: 0, right: 0, bottom: 0,");
  expect(viewer).toContain('gap: viewerFoot.track');
  expect(viewer).not.toContain('viewerFoot.photo');
  expect(viewer).not.toContain('viewerFoot.video');
  // The strip's own distance from the bottom edge comes from the strip's size, which is a pair —
  // 30 upright and 14 turned (`ViewerRotated*`) — and not from a gap that no longer has a picture
  // above it to be a gap from.
  expect(viewer).toContain('paddingBottom: Math.max(insets.bottom, stripSize.foot)');
  expect(viewer).toContain('<Filmstrip');
  expect(viewer.indexOf('size={stripSize}')).toBeGreaterThan(0);
});

test('the two darkenings are the layout’s own, one pair per way up the phone is held', () => {
  // Spec 8, the four `Viewer*` layouts (TASK-475): 150 at the head and 160 at the foot upright,
  // 110 and 120 turned. They are gradients off `photo` like every other darkening over a picture,
  // and they take no finger — the picture takes every touch under them.
  expect(viewer).toContain('const shade = turned ? viewerShade.turned : viewerShade.standing;');
  expect(viewer).toContain('height: shade.top');
  expect(viewer).toContain('height: shade.foot');
  expect(viewer.match(/pointerEvents="none"/g)).toHaveLength(2);
  // The foot's own gradient differs between the two — deeper upright than turned — and only the
  // turned one is the variant.
  expect(viewer).toContain('turned ? styles.shadeFootTurned : null');
  // Named tokens only: the window writes no colour of its own (the room it stands in, TASK-211).
  expect(viewer).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});

test('the notice says itself above the tools, not behind them', () => {
  // Saving, sharing and the delete all say what they are doing in a banner over the picture. The
  // stage is the whole of the phone now, so a notice pinned to its bottom would stand under the
  // strip — the one thing lying over the picture's foot (TASK-475).
  expect(viewer).toContain('const toolsTall =');
  expect(viewer).toContain('stripSize.tall +');
  expect(viewer).toContain('style={[styles.notice, { bottom: toolsTall + space.s4 }]}');
  // Over a video the scrubber is above the strip, so it counts too — the 14 of the gap and the 36
  // the sound button makes its row.
  expect(viewer).toContain('(playable !== null ? viewerFoot.track + height.roundRow : 0)');
});

test('the header and the pill answer to which way up the phone is', () => {
  // Spec 8, `ViewerRotated*`: the bar's buttons drop from 48 to 44, its sides open from 12 to 44,
  // and the date and «время · автор» lie on one line through a 3 dot rather than on two floors.
  // `ViewerBar` draws the row and the pill; the screen hands it the buttons at their own size.
  expect(viewer).toContain('turned={turned}');
  expect(viewer.match(/size=\{turned \? height\.roundBar : height\.roundViewer\}/g)).toHaveLength(
    2,
  );
  expect(viewer).toContain('style={[styles.bar, { top: turned ? 18 : insets.top }]}');
  // And the bar is what decides whether it is turned — the screen's own width against its own
  // height, which is also what `frameBox` is handed.
  expect(viewer).toContain('const turned = width > screen;');
  expect(bars).toContain('turned = false');
  expect(bars).toContain('viewerBarTurned');
  expect(bars).toContain('viewerPillTurned');
  expect(bars).toContain('viewerDot');
});

test('the film can be wound, and only while there is a length to wind it against', () => {
  // «Видео нельзя перемотать» off a device (TASK-181): the bar reported and took no finger at all.
  const track = viewer.slice(viewer.indexOf('<VideoTrack'), viewer.indexOf('<Filmstrip'));
  expect(track.replace(/\s+/g, ' ')).toContain(
    'onSeek={ runs > 0 ? (to) => { player.currentTime = to * runs; } : undefined }',
  );
});

test('the picture is walked with a finger, and the finger is taken on the picture alone', () => {
  // TASK-182, and the whole lesson of TASK-123 in one line: this window never had the gesture at
  // all — «над кадром стоит одиночный Image, а не пейджер». The other two sideways things on the
  // screen, the strip and the scrubber, each stand on a line of their own and must never see it.
  const swipe = viewer.slice(viewer.indexOf('const swipe = useMemo('));
  expect(viewer.match(/\{\.\.\.swipe\.panHandlers\}/g)).toHaveLength(1);
  expect(viewer.indexOf('{...swipe.panHandlers}')).toBeLessThan(viewer.indexOf('<VideoTrack'));
  // A tap belongs to whatever is under it; the walk asks for the finger only once it has plainly
  // gone sideways, and by capture — so a swipe begun on the pause button is still a swipe.
  expect(swipe).toContain('onStartShouldSetPanResponderCapture: () => false');
  // The picture takes a plain tap (TASK-476) without capture, where the responder system asks the
  // deeper view first: the pause button in the middle of a video keeps its own press, and a tap
  // anywhere else on the picture is the picture's. By capture it would be the other way about.
  expect(swipe).toContain('onStartShouldSetPanResponder: () => true');
  expect(swipe).toContain('Math.abs(g.dx) > SIDEWAYS && Math.abs(g.dx) > Math.abs(g.dy)');
  // Left is the next frame of the sheet, right the one before it.
  expect(swipe).toContain('step.current(g.dx < 0 ? 1 : -1);');
  // And built once, never per render (found in review): `PanResponder` keeps how far the finger
  // has come inside the object `create` returns, and a playing video re-renders this window four
  // times a second — a responder made afresh under a finger starts counting from nothing, and both
  // thresholds above end up measured against a scrap of the swipe. The walk worked on photographs
  // and failed on video, which is «не листается» for the third time. What moves between renders is
  // read through a ref instead.
  expect(swipe).toContain('PanResponder.create({');
  expect(swipe).toMatch(/\}\),\s*\[\],\s*\);/);
  expect(viewer).toContain('const step = useRef(stride);');
  // One rule about what opens, for the finger and for the strip alike — so photographs and videos
  // walk the same way whichever of the two asked, and the strip follows the frame in hand. The two
  // differ on one thing only: a tap names a frame and is refused when that frame cannot open,
  // while a finger names a direction and carries on past it rather than hitting a wall.
  //
  // The strip asks twice over (TASK-474) and both are that same `walk`: once by name, and once by
  // the frame a finger left the strip resting on. The answer is said back to the strip, so a frame
  // it will not open puts the strip back on the frame in hand rather than leaving it centred over
  // one this window never opened.
  expect(viewer).toContain('onPick={walk}');
  expect(viewer).toContain('onSettle={walk}');
  expect(viewer.match(/if \(!next \|\| !mayOpen\(next\)\) return false;/g)).toHaveLength(1);
  // And the frame is opened under that gate, never before it — what else stands between the two is
  // not the gate being moved (a step also puts the tools back, TASK-476).
  expect(viewer.replace(/\s+/g, ' ')).toContain('onOpen(next.id); return true;');
  expect(viewer.replace(/\s+/g, ' ')).toContain(
    'for (let to = index + by; to >= 0 && to < frames.length; to += by) ' +
      '{ if (mayOpen(frames[to])) return onOpen(frames[to].id); }',
  );
  expect(viewer).toContain('const index = frameIndex(frames, item.id);');
  expect(viewer).toContain('index={index}');
});

test("the strip under the frame is the grid's own list, in the grid's own order, read once", () => {
  // The whole list and not a window on it, and the strip has to read in the direction the sheet
  // above it does — which stopped being the plain `items` the moment TASK-121 cut the sheet into
  // days (found in review). The api sends the oldest frame first and a sheet is read newest day
  // down, so the tile at the top left of the grid was the one at the far end of the strip, and
  // walking the strip forward walked the sheet backwards. Both are now cut from the same `rows`.
  expect(frames).toContain('rows.flatMap((row) => row.frames ?? [])');
  expect(frames).toContain('frames={sheet}');
  expect(frames).toContain('data={rows}');
  // One read of the media serves both the sheet and the strip.
  expect(material.match(/listMedia\(/g)).toHaveLength(1);
  // And the library is handed that same list, picture for picture: the window invents no second
  // reading of a record — `@/lib/frames` answers for both sheets (TASK-86, TASK-120).
  expect(viewer).toContain(
    "frames.map((one) => ({ uri: frameOf(one).uri ?? '', video: one.kind === 'video' }))",
  );
});

test('the strip is walked to the frame in hand, and the walk hangs on its own width', () => {
  // Three reports, one lesson, and it lives with the strip itself now (TASK-147).
  //
  // `initialScrollIndex` is the prop this obviously wants and the one that broke it: it pins the
  // render window on the frame it names until a scroll event arrives, and a strip short enough to
  // fit on screen never scrolls, so the event never comes (TASK-70).
  //
  // `onContentSizeChange` unlatched fires far too often — it is the scroll row's own `onLayout`, so
  // it came back every time a frame landed, and each one hauled the strip back from under the
  // finger (TASK-106). Latched to fire once it fired at the wrong moment: an iOS modal is laid out
  // twice, the first commit sized from `RCTScreenSize()` — which swaps width for height on the way
  // the phone is *physically* held — and the content of a horizontal strip is the same width
  // whatever its viewport, so the size of the content never changed between the two commits
  // (TASK-123).
  //
  // So neither: the walk hangs on the strip's own viewport, keyed on the width it was computed for.
  // `frames` is still not among its keys, so a frame landing cannot haul the strip from under a
  // finger — which is the same bug seen from the other side now that a finger can walk it too.
  expect(filmstrip).not.toContain('initialScrollIndex={');
  expect(filmstrip).not.toContain('onContentSizeChange={');
  expect(filmstrip).toContain('onLayout={(e) => setViewport(e.nativeEvent.layout.width)}');
  expect(filmstrip).toContain('}, [index, viewport]);');
  expect(filmstrip).toContain('to(index, walked.current);');
  expect(filmstrip).toContain(
    'strip.current?.scrollToIndex({ index: at, viewPosition: 0.5, animated });',
  );
  // Centred, so the frame in hand lands where the eye already is; and `scrollToIndex` on a strip
  // this long is only safe because every tile is a known size.
  expect(filmstrip).toContain('getItemLayout=');
  // A memory holds up to a thousand records, and eleven of them are on screen: the strip is a
  // virtualised list and not a row holding every thumbnail the gallery has.
  expect(filmstrip).toContain('<FlatList');
  expect(filmstrip).not.toContain('<ScrollView');
  // And it answers a finger rather than only being walked (TASK-474): the frame the strip comes to
  // rest on is asked for at both ends of a touch, because a lift mid-flick is not where the strip
  // lands. `onScroll` is not among them — the frame in hand would change under the finger.
  expect(filmstrip).toContain('onScrollBeginDrag={() => {');
  expect(filmstrip).toContain('onScrollEndDrag={(e) => {');
  expect(filmstrip).toContain('onMomentumScrollEnd={(e) => rest(scrollTo(e))}');
  expect(filmstrip).not.toMatch(/\n\s*onScroll=\{/);
});

test('neither the sheet nor the strip opens a frame that is still developing', () => {
  // The exact ternary and not just a call count: swapping which branch is `undefined` would still
  // match `mayOpen(item)` while opening exactly the records this gate exists to stop. This was the
  // bug fixed in review — a tap on a waiting frame opened a whole screen saying «Проявляем…», which
  // is what was reported.
  //
  // Read with the whitespace squeezed out: what is pinned is which branch opens a frame, and the
  // tile moved two levels deeper the day the sheet was cut into days (TASK-121) — a ternary held to
  // the column it happened to be formatted in fails on a reindentation that changed nothing.
  expect(frames.replace(/\s+/g, ' ')).toContain('mayOpen(item) ? () => setOpen(item.id)');
  // The strip hands back which frame was touched rather than a record, so the window is where the
  // same gate stands for it — the same question, asked of the same helper. A finger that leaves the
  // strip on a frame goes through that very gate as well (TASK-474): it is asked by name, so the
  // strip can be told no and put itself back where it was.
  expect(viewer).toContain('onSettle={walk}');
  // The refusal comes first and `onOpen` after it, whatever stands between the two — a step also
  // puts the tools back (TASK-476), and that is not the gate being moved past the frame it refuses.
  expect(viewer.replace(/\s+/g, ' ')).toContain('if (!next || !mayOpen(next)) return false;');
  expect(viewer.replace(/\s+/g, ' ')).toContain('onOpen(next.id); return true;');
});

test('the frame shown full screen is read for the phone, the tiles for a tile', () => {
  // `openFrameOf` and not `frameOf` (TASK-120): the tile's 640px thumbnail drawn over the whole of a
  // phone is the mush that was reported, so the window asks for the big derivative first. Not
  // `item.preview_url` read straight either — both readings carry the fallen-frame correction for a
  // `ready` record with nothing on it, which is the «could not be prepared» state rather than a
  // broken image, and only `openFrameOf` keeps the thumbnail as the fallback under it.
  expect(viewer).toContain('const shown = openFrameOf(item);');
  expect(viewer).toContain('<Image');
  expect(viewer).toContain('uri: shown.uri,');
  // The grid is the other reading, and it is the tile's own.
  expect(frames).toContain('const frame = frameOf(item);');
});

test('the open frame is kept on the phone, filed under the record and not under its signature', () => {
  // The frame opened a second time came down the wire a second time (TASK-137). React Native's own
  // `Image` has no disk behind it at all, and `expo-image` — already what every tile is drawn with —
  // has one by default. Both are spelled `<Image`, so what is pinned is where the name comes from.
  expect(viewer).toContain("import { Image } from 'expo-image';");
  expect(viewer).toContain('contentFit="contain"');
  expect(viewer).not.toContain('resizeMode="contain"');

  // What it is filed under has to be said outright. The api signs every link afresh on every read of
  // the gallery and each one lasts a quarter of an hour (`R2_DOWNLOAD_TTL_SECONDS`), so the same
  // bytes arrive under a new url every time — and `expo-image`'s own default key is the url. Left
  // alone, the disk would be full of one frame under a dozen names and every look a fresh download.
  expect(viewer).toContain('cacheKey: `${item.id}:');
  const key = viewer.slice(viewer.indexOf('cacheKey:'));
  expect(key.slice(0, key.indexOf('\n'))).not.toContain('${shown.uri}');
});

test('what expo-image keeps on disk has a ceiling, set once at startup and only where there is none', () => {
  // Unbounded on ios: SDWebImage, which `expo-image` is built on there, defaults `maxDiskSize` to 0
  // — keep everything for ever. 250MB, oldest out first, is what Glide gives android without being
  // asked, so the number is that one and the two platforms hold the same. Behind the platform test
  // and not called flat: android has no such method in its native module, and the call there would
  // be a crash on the way up.
  expect(layout.replace(/\s+/g, ' ')).toContain(
    "if (Platform.OS === 'ios') Image.configureCache({ maxDiskSize: 262144000 })",
  );
  // Once, and as the app comes up rather than when a screen mounts — beside the portrait lock, above
  // every component in the file.
  expect(layout.match(/configureCache/g)).toHaveLength(1);
  expect(layout.indexOf('configureCache')).toBeLessThan(layout.indexOf('export default function'));
});

// The contact sheet itself, measured by the designer (TASK-79): the last frame of a sheet came out
// 2pt wider than every frame above it, and the frame the strip had open came out smaller than its
// neighbours. Both are one question — how wide a column of the kit's sheet is — and both screens
// that draw a sheet have to answer it the same way.
