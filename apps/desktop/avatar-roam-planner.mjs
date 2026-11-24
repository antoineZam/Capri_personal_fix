// SPDX-License-Identifier: GPL-3.0-only
// Chooses where desktop roaming goes next. Pure: no Electron, timers or screen access.
import { surfaceDock } from './avatar-terrain.mjs';

/** Base weight of one surface (shared by its sampled contacts) or of the free point. */
export const ROAM_WEIGHTS = Object.freeze({
  corner: 1.4,
  seat: 1,
  floor: 0.8,
  left: 0.6,
  right: 0.6,
  ceiling: 0.3,
  free: 0.25,
});
const PREFERRED = 3;
const FOREGROUND = 2.5;
const RECENT_WINDOW = 0.3;
const SAME_KIND = 0.6;
const SHORT = 0.2;
const SHORT_REACH = 0.15;

/** One or two contacts per surface, so long edges do not crowd out corners. */
export function roamCandidates(surfaces, random, samples = 2) {
  return (surfaces ?? []).flatMap((surface) => {
    const { from, to, dock, windowId, foreground, rect } = surface;
    const positions =
      from === to ? [from] : Array.from({ length: samples }, () => from + random() * (to - from));
    return positions.map((position) => ({
      kind: dock.kind,
      dock: surfaceDock(surface, position),
      windowId,
      foreground,
      rect,
      share: 1 / positions.length,
    }));
  });
}

function weigh(candidate, { from, diagonal, last, streak, preferWindowId }) {
  const { kind, windowId, point } = candidate;
  if (windowId && windowId === streak) return 0;
  let weight = (ROAM_WEIGHTS[kind] ?? 0) * (candidate.share ?? 1);
  if (windowId && windowId === preferWindowId) weight *= PREFERRED;
  if (candidate.foreground) weight *= FOREGROUND;
  if (windowId && last.some((move) => move.windowId === windowId)) weight *= RECENT_WINDOW;
  if (last[0]?.kind === kind) weight *= SAME_KIND;
  if (from && point && Math.hypot(point.x - from.x, point.y - from.y) < diagonal * SHORT_REACH)
    weight *= SHORT;
  return weight;
}

/**
 * The first `limit` candidates in weighted random order without replacement
 * (Efraimidis–Spirakis keys). recent: successful moves, newest first. A window
 * that took the last three moves sits the next one out; fits() refusals are counted.
 */
export function planRoam({
  candidates,
  from,
  diagonal = 0,
  recent = [],
  preferWindowId,
  fits = () => true,
  random = Math.random,
  limit = 3,
}) {
  const last = recent.slice(0, 3);
  const streak =
    last.length === 3 && last.every(({ windowId }) => windowId && windowId === last[0].windowId)
      ? last[0].windowId
      : null;
  const context = { from, diagonal, last, streak, preferWindowId };
  let unfit = 0;
  const keyed = [];
  for (const candidate of candidates) {
    if (!fits(candidate)) {
      unfit++;
      continue;
    }
    const weight = weigh(candidate, context);
    if (weight > 0) keyed.push({ key: random() ** (1 / weight), choice: { ...candidate, weight } });
  }
  keyed.sort((a, b) => b.key - a.key);
  return { order: keyed.slice(0, limit).map(({ choice }) => choice), unfit };
}
