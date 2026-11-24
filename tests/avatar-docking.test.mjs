// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { poseExtents } from '../apps/desktop/avatar-docking.mjs';

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
