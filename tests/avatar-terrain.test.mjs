// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTerrain,
  subtractIntervals,
  surfaceDock,
  windowSurfaces,
} from '../apps/desktop/avatar-terrain.mjs';

// Rounded pose boxes around their contact at a 240 px sprite.
const seat = { left: -80, right: 90, top: -127, bottom: 77 };
const floor = { left: -84, right: 85, top: -175, bottom: 0 };
const area = (id, x, width = 1920) => ({
  id,
  rect: { x, y: 0, width, height: 1040 },
  poses: { seat, floor, left: null, right: null, ceiling: null },
});
const main = area(1, 0);
const window = (windowId, rect, perch = true) => ({ windowId, rect, perch, foreground: false });
const seats = (surfaces, windowId) =>
  surfaces.filter((s) => s.windowId === windowId && s.dock.kind === 'seat');

test('interval subtraction keeps closed pieces outside open cuts', () => {
  assert.deepEqual(subtractIntervals([0, 10], [[20, 30]]), [[0, 10]]);
  assert.deepEqual(subtractIntervals([0, 10], [[3, 6]]), [
    [0, 3],
    [6, 10],
  ]);
  assert.deepEqual(subtractIntervals([0, 10], [[10, 12]]), [[0, 10]]);
  assert.deepEqual(subtractIntervals([0, 10], [[-1, 11]]), []);
  assert.deepEqual(subtractIntervals([5, 5], [[5, 9]]), [[5, 5]]);
  assert.deepEqual(subtractIntervals([5, 5], [[4, 6]]), []);
  assert.deepEqual(subtractIntervals([6, 5], []), []);
});

test('a window in front leaves only the visible part of the seat edge', () => {
  const a = window('1', { x: 400, y: 300, width: 800, height: 500 });
  const b = window('2', { x: 300, y: 100, width: 500, height: 400 });
  const [span, ...rest] = seats(buildTerrain([b, a], [main]), '1');
  assert.deepEqual(rest, []);
  assert.equal(span.from, 300 + 500 - seat.left);
  assert.equal(span.to, 400 + 800 * 0.9);
  assert.deepEqual(span.dock, { kind: 'seat', edge: 'top' });
});

test('windows that cannot be perched still hide the edges behind them', () => {
  const a = window('1', { x: 400, y: 300, width: 800, height: 500 });
  const zoomed = window('2', { x: 0, y: 0, width: 1920, height: 1040 }, false);
  const surfaces = buildTerrain([zoomed, a], [main], { floors: false });
  assert.deepEqual(surfaces, []);
});

test('a top edge with no room above it is not a seat', () => {
  const docked = window('1', { x: 0, y: 0, width: 960, height: 1040 });
  assert.deepEqual(seats(buildTerrain([docked], [main]), '1'), []);
  const lower = window('1', { x: 0, y: 200, width: 960, height: 840 });
  assert.equal(seats(buildTerrain([lower], [main]), '1').length, 1);
});

test('a window across two displays gives one seat span per display', () => {
  const right = area(2, 1920);
  const wide = window('1', { x: 1400, y: 300, width: 1000, height: 500 });
  const spans = seats(buildTerrain([wide], [main, right]), '1');
  assert.deepEqual(
    spans.map(({ areaId }) => areaId),
    [1, 2],
  );
  assert.equal(spans[0].to, 1920 - seat.right);
  assert.equal(spans[1].from, 1920 - seat.left);
  for (const span of spans) {
    const { x, width } = (span.areaId === 1 ? main : right).rect;
    assert.ok(span.from + seat.left >= x && span.to + seat.right <= x + width);
  }
});

test('floors follow each work area and are only cut by the given occluders', () => {
  const right = area(2, 1920);
  const zoomed = window('1', { x: 0, y: 0, width: 1920, height: 1040 }, false);
  const floors = buildTerrain([zoomed], [main, right]).filter((s) => s.dock.kind === 'floor');
  assert.deepEqual(
    floors.map(({ areaId, windowId }) => [areaId, windowId]),
    [
      [1, null],
      [2, null],
    ],
  );
  assert.deepEqual([floors[0].from, floors[0].to], [-floor.left, 1920 - floor.right]);
  const companion = { x: 1500, y: 700, width: 400, height: 340 };
  const [left, ...rest] = buildTerrain([], [main], { occluders: [companion] });
  assert.deepEqual(rest, []);
  assert.deepEqual([left.from, left.to], [-floor.left, 1500 - floor.right]);
});

test('occluders outside the pose band do not cut an edge', () => {
  const a = window('1', { x: 400, y: 500, width: 800, height: 400 });
  const above = window('2', { x: 600, y: 100, width: 200, height: 500 + seat.top - 100 });
  const below = window('3', { x: 600, y: 500 + seat.bottom, width: 200, height: 100 });
  const spans = seats(buildTerrain([above, below, a], [main]), '1');
  assert.deepEqual(
    spans.map(({ from, to }) => [from, to]),
    [[480, 1120]],
  );
});

test('a slack lets poses that wrap a few pixels past the work area still fit', () => {
  const docked = window('1', { x: 0, y: 127, width: 960, height: 900 });
  const tight = { ...main, rect: { ...main.rect, y: 1 } };
  assert.deepEqual(seats(buildTerrain([docked], [tight]), '1'), []);
  assert.equal(seats(buildTerrain([docked], [tight], { slack: 2 }), '1').length, 1);
});

test('surface docks carry the fraction of their edge', () => {
  const rect = { x: 100, y: 200, width: 400, height: 300 };
  const top = { dock: { kind: 'seat', edge: 'top' }, rect };
  assert.deepEqual(surfaceDock(top, 200), { kind: 'seat', edge: 'top', fraction: 0.25 });
  const side = { dock: { kind: 'left', edge: 'left' }, rect };
  assert.deepEqual(surfaceDock(side, 260), { kind: 'left', edge: 'left', fraction: 0.2 });
});

test('native window surfaces are validated and reduced to geometry', () => {
  assert.equal(windowSurfaces(null), null);
  assert.equal(windowSurfaces({ ok: true }), null);
  const good = { windowId: '42', x: -5, y: 10, width: 300, height: 200, perch: true };
  const entries = [
    { ...good, foreground: true, title: 'Secret' },
    { ...good, windowId: 'x1', foreground: false },
    { ...good, windowId: 7, foreground: false },
    { ...good, x: 2 ** 60, foreground: false },
    { ...good, perch: 'yes', foreground: false },
    { ...good, width: 0, foreground: false },
  ];
  assert.deepEqual(windowSurfaces({ ok: true, windows: entries }), [
    {
      windowId: '42',
      rect: { x: -5, y: 10, width: 300, height: 200 },
      perch: true,
      foreground: true,
    },
  ]);
  const many = Array.from({ length: 40 }, () => ({ ...good, foreground: false }));
  assert.equal(windowSurfaces({ ok: true, windows: many }).length, 32);
});
