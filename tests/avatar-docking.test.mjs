// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIRRORED_SEAT,
  avatarDockFrame,
  avatarDockPoint,
  mirrorPose,
  nearestAvatarDock,
  poseExtents,
} from '../apps/desktop/avatar-docking.mjs';
import { dockFits } from '../apps/desktop/main/avatar-detach.mjs';

const canvas = { width: 1254, height: 1254 };
const seat = { x: 599 / 1254, y: 773 / 1254 };
const seatBounds = { x: 183, y: 110, width: 887, height: 1067 };

test('pose extents measure the visible box around its contact point', () => {
  const extents = poseExtents(seat, seatBounds, canvas, 240);
  const expected = {
    left: ((183 - 599) / 1254) * 240,
    right: ((183 + 887 - 599) / 1254) * 240,
    top: ((110 - 773) / 1254) * 240,
    bottom: ((110 + 1067 - 773) / 1254) * 240,
  };
  for (const side of Object.keys(expected))
    assert.ok(Math.abs(extents[side] - expected[side]) < 1e-9, side);
  assert.ok(extents.left < 0 && extents.top < 0 && extents.right > 0 && extents.bottom > 0);
});

const window = { x: 400, y: 300, width: 800, height: 500 };

test('drops near a top corner of a window dock on that corner', () => {
  assert.deepEqual(nearestAvatarDock({ x: 393, y: 293 }, window, 36), {
    kind: 'corner',
    edge: 'top',
    side: 'left',
    fraction: 0,
    distance: Math.hypot(7, 7) * 0.6,
  });
  assert.equal(nearestAvatarDock({ x: 1207, y: 293 }, window, 36).side, 'right');
  assert.equal(nearestAvatarDock({ x: 800, y: 290 }, window, 36).kind, 'seat');
  assert.equal(nearestAvatarDock({ x: 393, y: 293 }, window, 36, true)?.kind, undefined);
  assert.deepEqual(avatarDockPoint(window, { kind: 'corner', edge: 'top', fraction: 0 }), {
    x: 400,
    y: 300,
  });
  assert.deepEqual(avatarDockPoint(window, { kind: 'corner', edge: 'top', fraction: 1 }), {
    x: 1200,
    y: 300,
  });
});

test('the right corner seats a mirrored copy of the seat pose', () => {
  const sitting = {
    id: 'pose-sit-edge',
    anchor: { name: 'seat', x: 599, y: 773 },
    visibleBounds: seatBounds,
  };
  const mirrored = mirrorPose(sitting, canvas);
  assert.equal(mirrored.id, 'pose-sit-edge');
  assert.equal(mirrored.source, sitting);
  assert.equal(mirrored.mirror, true);
  assert.deepEqual(mirrored.anchor, { name: 'seat', x: 655, y: 773 });
  assert.deepEqual(mirrored.visibleBounds, { x: 184, y: 110, width: 887, height: 1067 });
  const frames = new Map([
    ['pose-sit-edge', sitting],
    [MIRRORED_SEAT, mirrored],
  ]);
  const corner = (side) => avatarDockFrame(frames, { kind: 'corner', edge: 'top', side });
  assert.equal(corner('left'), sitting);
  assert.equal(corner('right'), mirrored);

  // A window flush with the right screen edge: only the left corner keeps the body on screen.
  const area = { x: 0, y: 0, width: 1920, height: 1040 };
  const fits = ({ anchor, visibleBounds }, contact) =>
    dockFits(
      contact,
      area,
      240,
      { x: anchor.x / canvas.width, y: anchor.y / canvas.height },
      visibleBounds,
      canvas,
    );
  assert.equal(fits(mirrored, { x: 1920, y: 300 }), false);
  assert.equal(fits(sitting, { x: 1200, y: 300 }), true);
});
