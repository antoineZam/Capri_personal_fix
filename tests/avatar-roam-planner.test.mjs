// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { glideMove, planRoam, roamCandidates } from '../apps/desktop/avatar-roam-planner.mjs';

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rect = (x) => ({ x, y: 300, width: 400, height: 300 });
const surface = (windowId, kind, x, foreground = false) => ({
  dock: { kind, edge: kind === 'floor' ? 'bottom' : 'top' },
  windowId,
  foreground,
  rect: rect(x),
  from: x + 40,
  to: x + 360,
});
const free = { kind: 'free', point: { x: 960, y: 700 } };
const desk = (random, foreground = 'b') =>
  roamCandidates(
    [
      surface('a', 'seat', 0, foreground === 'a'),
      surface('b', 'seat', 600, foreground === 'b'),
      surface('c', 'seat', 1200, foreground === 'c'),
      surface(null, 'floor', 0),
    ],
    random,
  ).concat(free);
const tally = (plans) => {
  const counts = {};
  for (const { order } of plans) {
    const key = order[0].windowId ?? order[0].kind;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
};

test('the foreground window is the usual destination, without excluding the rest', () => {
  const random = seeded(7);
  const counts = tally(
    Array.from({ length: 1000 }, () => planRoam({ candidates: desk(random), random })),
  );
  assert.ok(counts.b > counts.a && counts.b > counts.c && counts.b > counts.floor, counts);
  for (const key of ['a', 'c', 'floor']) assert.ok(counts[key] > 0, key);
});

test('an observed window is preferred, not locked', () => {
  const random = seeded(11);
  const counts = tally(
    Array.from({ length: 1000 }, () =>
      planRoam({ candidates: desk(random, null), preferWindowId: 'c', random }),
    ),
  );
  for (const key of ['a', 'b', 'floor', 'free']) assert.ok(counts.c > 2 * counts[key], counts);
  assert.ok(Object.keys(counts).length > 1, counts);
});

test('without terrain the free point is the only plan', () => {
  assert.deepEqual(roamCandidates(null, Math.random), []);
  const { order } = planRoam({ candidates: [free], random: seeded(3) });
  assert.deepEqual(
    order.map(({ kind }) => kind),
    ['free'],
  );
});

test('candidates that do not fit never appear and are counted', () => {
  const random = seeded(5);
  for (let run = 0; run < 200; run++) {
    const { order, unfit } = planRoam({
      candidates: desk(random),
      fits: (candidate) => candidate.windowId !== 'b',
      random,
      limit: 10,
    });
    assert.equal(unfit, 2);
    assert.ok(order.every(({ windowId }) => windowId !== 'b'));
  }
});

test('the same window is never chosen four times in a row', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const random = seeded(seed);
    const recent = [];
    let streak = 0;
    let previous;
    for (let move = 0; move < 200; move++) {
      const { order } = planRoam({
        candidates: desk(random),
        preferWindowId: 'b',
        recent: recent.slice(0, 5),
        random,
      });
      const [choice] = order;
      recent.unshift({ kind: choice.kind, windowId: choice.windowId });
      streak = choice.windowId && choice.windowId === previous ? streak + 1 : 1;
      previous = choice.windowId;
      assert.ok(streak < 4, `seed ${seed}, move ${move}`);
    }
  }
});

test('short hops are less likely than equally good far ones', () => {
  const random = seeded(9);
  const near = { kind: 'free', point: { x: 120, y: 100 } };
  const far = { kind: 'free', point: { x: 1800, y: 900 } };
  let nearFirst = 0;
  for (let run = 0; run < 1000; run++) {
    const { order } = planRoam({
      candidates: [near, far],
      current: { point: { x: 100, y: 100 } },
      diagonal: Math.hypot(1920, 1040),
      random,
    });
    if (order[0].point === near.point) nearFirst++;
  }
  assert.ok(nearFirst < 300, nearFirst);
});

test('corners are one contact, edges are sampled inside their span', () => {
  const random = seeded(2);
  const corner = {
    dock: { kind: 'corner', edge: 'top', side: 'right' },
    windowId: 'a',
    foreground: false,
    rect: rect(0),
    from: 400,
    to: 400,
  };
  const [only, ...rest] = roamCandidates([corner], random);
  assert.deepEqual(rest, []);
  assert.equal(only.dock.fraction, 1);
  assert.equal(only.share, 1);
  const samples = roamCandidates([surface('a', 'seat', 0)], random);
  assert.equal(samples.length, 2);
  for (const { dock, share } of samples) {
    assert.equal(share, 0.5);
    assert.ok(dock.fraction >= 0.1 && dock.fraction <= 0.9);
  }
});

test('moves along the current top edge glide instead of teleporting', () => {
  const seat = { kind: 'seat', edge: 'top', fraction: 0.3 };
  const current = { windowId: 'a', dock: seat, point: { x: 500, y: 300 } };
  const along = {
    kind: 'seat',
    windowId: 'a',
    dock: { ...seat, fraction: 0.7 },
    point: { x: 800, y: 300 },
  };
  assert.equal(glideMove(current, along, 240), 500);
  assert.equal(glideMove(current, { ...along, point: { x: 510, y: 300 } }, 240), 350);
  assert.equal(glideMove(current, { ...along, point: { x: 1900, y: 300 } }, 240), 1500);
  const right = { kind: 'corner', edge: 'top', side: 'right', fraction: 1 };
  assert.equal(
    glideMove(current, { ...along, kind: 'corner', dock: right }, 240),
    0,
    'mirror flips',
  );
  const left = { kind: 'corner', edge: 'top', side: 'left', fraction: 0 };
  assert.ok(glideMove(current, { ...along, kind: 'corner', dock: left }, 240) > 0);
  assert.equal(glideMove(current, { ...along, windowId: 'b' }, 240), 0);
  assert.equal(glideMove(current, { ...along, dock: { kind: 'left', edge: 'left' } }, 240), 0);
  assert.equal(glideMove({ ...current, windowId: undefined }, along, 240), 0);

  // A nearby glide on the window just used is not penalised like a short hop.
  const near = { ...along, point: { x: 520, y: 300 } };
  const recent = [{ kind: 'corner', windowId: 'a' }];
  const plan = (candidate, place) =>
    planRoam({
      candidates: [candidate],
      current: place,
      diagonal: 2000,
      recent,
      random: () => 0.5,
    }).order[0];
  const glided = plan(near, current);
  assert.ok(glided.glide > 0);
  assert.equal(glided.weight, 0.8);
  const hopped = plan({ ...near, windowId: 'b' }, current);
  assert.equal(hopped.glide, undefined);
  assert.ok(hopped.weight < glided.weight);
});

test('glides still never give one window four moves in a row', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const random = seeded(seed);
    const recent = [];
    let current;
    let streak = 0;
    for (let move = 0; move < 200; move++) {
      const candidates = desk(random).map((candidate) => ({
        ...candidate,
        point: candidate.point ?? { x: candidate.rect.x + candidate.dock.fraction * 400, y: 300 },
      }));
      const [choice] = planRoam({ candidates, current, recent: recent.slice(0, 5), random }).order;
      streak = choice.windowId && choice.windowId === current?.windowId ? streak + 1 : 1;
      assert.ok(streak < 4, `seed ${seed}, move ${move}`);
      recent.unshift({ kind: choice.kind, windowId: choice.windowId });
      current = { windowId: choice.windowId, dock: choice.dock, point: choice.point };
    }
  }
});

test('the free spot always ends the plan as the last resort', () => {
  const random = seeded(13);
  for (let run = 0; run < 200; run++) {
    const { order } = planRoam({ candidates: desk(random, 'a'), random });
    assert.equal(order.filter(({ kind }) => kind === 'free').length, 1);
    assert.ok(order.length <= 4);
    if (order.length === 4) assert.equal(order.at(-1).kind, 'free');
  }
  const { order } = planRoam({ candidates: desk(seeded(1)).filter(({ kind }) => kind !== 'free') });
  assert.equal(order.length, 3);
});
