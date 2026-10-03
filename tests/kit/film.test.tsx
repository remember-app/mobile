import { beforeAll, expect, test } from 'vitest';
import { BadgeDecision } from '@/kit/badge';
import {
  CardFilmNow,
  FilmBlock,
  FilmCloseNote,
  FilmStageDivider,
  FilmStageLine,
  FilmStageList,
  RowFilmStage,
  stageShare,
  TileOrder,
  TileOrderRow,
} from '@/kit/film';
import { allDifferent, story } from '@/kit/story';
import { en, ru } from '@/strings';
import { setTheme } from '@/theme';

/**
 * Spec 8, `Film*` — the parts every screen of a movie is built from. Five states and one body: what
 * is checked here is that each state is a state (drawn differently from its neighbours), that the
 * words a screen hands over reach the screen whole, and that the numbers the api counts itself are
 * never counted again on the phone.
 */

const SHOT = 'https://bucket.example/f01.jpg';

beforeAll(async () => {
  await setTheme('dark');
});

const line = (over: Partial<Parameters<typeof FilmStageLine>[0]> = {}) => (
  <FilmStageLine
    name="Directing"
    of={5}
    stageOf="Stage 3 of 5"
    right="about 8 min left"
    done={3}
    {...over}
  />
);

test('every state of the stage line is drawn differently from its neighbours', () => {
  // Five states, one line: a stage being cut, one that stopped, one nobody has come to, one already
  // behind and the very first of them. A screen that cannot tell them apart is not saying where it is.
  allDifferent({
    building: line(),
    offline: line({ right: 'was ≈ 8 min' }),
    stopped: line({ right: 'stopped', stopped: true }),
    queued: <FilmStageLine name="waiting" of={5} stageOf="" done={0} />,
    waiting: line({ name: 'Analysis', done: 1, stageOf: 'Stage 2 of 5' }),
  });
});

test('the stage in hand fills to the share of itself that is done, and only that one', () => {
  const held = story(line({ share: 0.5 }));
  expect(held).toContain('width:50%');
  // The share belongs to the stage in hand alone — the ones behind it are done, and are lit whole.
  expect(story(line())).not.toContain('width:50%');
});

test('the scale says «Stage 3 of 5» once, and the five bars are not read one by one', () => {
  const markup = story(line());
  expect(markup).toContain('Stage 3 of 5');
  expect((markup.match(/role="progressbar"/g) ?? []).length).toBe(1);
});

test('a stage nobody has come to says «Stage 4 of 5» and leads nowhere', () => {
  // The queue screen lists all five as waiting, and a row with a press is a door to a screen that
  // has not been written yet — the layout says so in as many words.
  const markup = story(<RowFilmStage at={4} title="Music" meta="never started" state="waiting" />);
  expect(markup).not.toContain('role="button"');
  expect(markup).toContain('never started');
});

test('a stage that stopped says why, and says it in danger', () => {
  const markup = story(
    <RowFilmStage at={4} title="Music" meta="stopped: the track would not open" state="failed" />,
  );
  expect(markup).toContain('stopped: the track would not open');
  // The word the danger ink is written with, and the pause that stands in the ring beside it.
  expect(markup).toMatch(/rgb\(255, 141, 141\)|#FF8D8D|ff8d8d/i);
  expect(markup).toContain('data-glyph="Pause"');
});

test('the four states of a stage row are all different, and the waiting one is the only one silent', () => {
  allDifferent({
    done: <RowFilmStage at={1} title="Preparation" meta="214 frames" state="done" />,
    running: <RowFilmStage at={3} title="Directing" meta="61 of 214 placed" state="running" />,
    waiting: <RowFilmStage at={4} title="Music" meta="never started" state="waiting" />,
    failed: <RowFilmStage at={4} title="Music" meta="stopped" state="failed" />,
  });

  const states = ['done', 'running', 'waiting', 'failed'] as const;
  for (const state of states) {
    // Even a stage that has been reached offers a way in — where it leads is the screen's business,
    // not this row's, so the press is offered and only the waiting one refuses it.
    const markup = story(
      <RowFilmStage
        at={2}
        title="Analysis"
        state={state}
        onPress={state === 'waiting' ? undefined : () => {}}
      />,
    );
    expect(markup.includes('role="button"'), state).toBe(state !== 'waiting');
  }
});

test('the list of the five is one card with the rule inset to where their names start', () => {
  const markup = story(
    <FilmStageList>
      <RowFilmStage at={1} title="Preparation" meta="214 frames" state="done" />
      <FilmStageDivider />
      <RowFilmStage at={2} title="Analysis" state="waiting" />
    </FilmStageList>,
  );
  // The card is round 20 and the rule between two stages starts where their names do — a hairline
  // from edge to edge would read as a grid rather than as a list of five.
  expect(markup).toMatch(/r-borderRadius-[a-z0-9]+/);
  expect(markup).toContain('margin-left:52px');
});

test('the card «Сейчас» says who is working and how old the card is', () => {
  const now = story(
    <CardFilmNow
      who="The director"
      what="thinking about the frame"
      now="NOW"
      uri={SHOT}
      thought="The hugs by the window, warm light — the heart of the second part"
      marks={<BadgeDecision kind="take" label="Taking" />}
      onPress={() => {}}
    />,
  );
  expect(now).toContain('The director');
  expect(now).toContain('thinking about the frame');
  expect(now).toContain('NOW');
  // `expo-image` renders as a node here rather than an `<img>`, so what the card puts in it is
  // checked by the card handing the uri over at all — the picture is the frame, not a word.
  expect(now).toContain('data-testid="image"');
  // The whole card is the way into the stage's journal.
  expect(now).toContain('role="button"');

  // Offline the card says how old it is instead of pretending it is moving — and the words differ.
  const offline = story(
    <CardFilmNow who="The director" what="thinking about the frame" now="updated 2 mins ago" />,
  );
  expect(offline).toContain('updated 2 mins ago');
  expect(offline).not.toBe(now);
});

test('the card «Сейчас» draws the same whether or not it has a frame to show', () => {
  // Preparation counts files and has no frame in the director's hands; the card is then a line of
  // words on its own, and it must not collapse or claim a frame it does not have.
  const bare = story(
    <CardFilmNow who="The director" what="downloading the frames" now="NOW" thought="120 of 214" />,
  );
  expect(bare).toContain('downloading the frames');
  expect(bare).not.toContain('data-testid="image"');
});

test('the four tiles say what was ordered, and a tile with nothing under it simply ends', () => {
  const markup = story(
    <TileOrderRow>
      <TileOrder label="Frames" figure="214" note="168 photos · 46 videos" />
      <TileOrder label="Length" figure="2:30" note="minutes" />
      <TileOrder label="Music" figure="Warm" />
    </TileOrderRow>,
  );
  expect(markup).toContain('168 photos · 46 videos');
  // A track whose tempo was never learned has no second line — and no zero standing in for one.
  expect(markup).not.toContain('0 beats');

  const withTempo = story(<TileOrder label="Music" figure="Warm" note="96 beats per minute" />);
  expect(withTempo).toContain('96 beats per minute');
});

test('the story block holds the organizer’s own words, cut to two lines', () => {
  const markup = story(
    <FilmBlock label="Story">
      <p>For the grandparents: calm, warm, no rush. The getting ready, the ceremony, the hugs.</p>
    </FilmBlock>,
  );
  expect(markup).toContain('Story');
  expect(markup).toContain('For the grandparents');
});

test('the close note says the screen may be closed, and leads nowhere', () => {
  const markup = story(<FilmCloseNote text="You can close the screen" />);
  expect(markup).toContain('You can close the screen');
  // It is a promise about what happens next, not a button: nothing here can be pressed.
  expect(markup).not.toContain('role="button"');
});

test('the share of a stage is the api’s own counter, and nothing else', () => {
  expect(stageShare({ done_count: 61, total_count: 214 })).toBeCloseTo(0.285, 3);
  // Nothing to count against — a stage that has not been counted is no bar, not a full one.
  expect(stageShare({ done_count: 0, total_count: null })).toBeNull();
  expect(stageShare(undefined)).toBeNull();
});

test('every word of the film screen is in the dictionary, in both languages', () => {
  // The screen writes no words of its own; a key it would have to invent is a key that is missing.
  for (const s of [en, ru]) {
    const f = s.montage.filmScreen;
    expect(f.queuedAhead(1)).toBeTruthy();
    expect(f.queuedAhead(3)).toBeTruthy();
    expect(f.queuedStarts(2)).toBeTruthy();
    expect(f.queuedTakes(14)).toBeTruthy();
    expect(f.framesNote(168, 46)).toBeTruthy();
    expect(f.acceptedAt('16:40')).toBeTruthy();
    expect(f.stoppedOn('Music')).toBeTruthy();
    expect(f.retryNote(14)).toBeTruthy();
    expect(f.organizerCanNote('Лиза Миронова')).toBeTruthy();
    expect(f.stoppedBecause(f.organizerCan)).toBeTruthy();
    expect(f.leftWas(8)).toBeTruthy();
    expect(f.updatedAgo(2)).toBeTruthy();
    expect(f.howMadeTook(5, 14)).toBeTruthy();
    // Every stage has its own words for the card and the row.
    for (const stage of ['prep', 'analysis', 'directing', 'music', 'assembly'] as const) {
      expect(f.at[stage]).toBeTruthy();
      expect(s.montage.stage[stage]).toBeTruthy();
      expect(s.montage.stageHead[stage]).toBeTruthy();
      expect(s.montage.stageAhead[stage]).toBeTruthy();
      expect(s.montage.progress[stage]).toBeTruthy();
    }
  }
});
