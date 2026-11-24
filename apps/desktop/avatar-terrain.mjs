// SPDX-License-Identifier: GPL-3.0-only
// Open window edges for desktop roaming. Pure geometry in the caller's units
// (physical pixels for roaming): no Electron, no titles, no screen capture.

const AXES = {
  x: { pos: 'x', size: 'width', low: 'left', high: 'right' },
  y: { pos: 'y', size: 'height', low: 'top', high: 'bottom' },
};

// Fractions are of the window edge (corners are its ends); the floor spans the work area.
export const TERRAIN_TEMPLATES = Object.freeze([
  { id: 'seat', dock: { kind: 'seat', edge: 'top' }, range: [0.1, 0.9] },
  { id: 'left', dock: { kind: 'left', edge: 'left' }, range: [0.08, 0.3] },
  { id: 'right', dock: { kind: 'right', edge: 'right' }, range: [0.08, 0.3] },
  { id: 'ceiling', dock: { kind: 'ceiling', edge: 'bottom' }, range: [0.1, 0.9] },
  { id: 'corner-left', dock: { kind: 'corner', edge: 'top', side: 'left' }, range: [0, 0] },
  { id: 'corner-right', dock: { kind: 'corner', edge: 'top', side: 'right' }, range: [1, 1] },
]);
const FLOOR = { id: 'floor', dock: { kind: 'floor', edge: 'bottom' }, range: [0.04, 0.96] };

/** Closed pieces of [start, end] outside the open cuts; a single point survives unless cut through. */
export function subtractIntervals([start, end], cuts) {
  let pieces = start <= end ? [[start, end]] : [];
  for (const [a, b] of cuts)
    pieces = pieces.flatMap(([s, e]) =>
      b <= s || a >= e
        ? [[s, e]]
        : [
            [s, Math.min(a, e)],
            [Math.max(b, s), e],
          ].filter(([low, high]) => high > low),
    );
  return pieces;
}

function edgeAxes(edge) {
  const horizontal = edge === 'top' || edge === 'bottom';
  return { along: AXES[horizontal ? 'x' : 'y'], across: AXES[horizontal ? 'y' : 'x'] };
}

/**
 * Contact spans along one edge of rect where the pose box (extents around the
 * contact) stays inside area, within slack, and clear of every occluder.
 */
export function edgeSpans(rect, { dock, range }, extents, area, occluders, slack = 0) {
  const { along, across } = edgeAxes(dock.edge);
  const line =
    rect[across.pos] + (dock.edge === 'top' || dock.edge === 'left' ? 0 : rect[across.size]);
  const near = line + extents[across.low];
  const far = line + extents[across.high];
  if (near < area[across.pos] - slack || far > area[across.pos] + area[across.size] + slack)
    return [];
  const start = rect[along.pos];
  const cuts = occluders
    .filter((o) => o[across.pos] < far && o[across.pos] + o[across.size] > near)
    .map((o) => [
      o[along.pos] - extents[along.high],
      o[along.pos] + o[along.size] - extents[along.low],
    ]);
  return subtractIntervals(
    [
      Math.max(start + rect[along.size] * range[0], area[along.pos] - extents[along.low] - slack),
      Math.min(
        start + rect[along.size] * range[1],
        area[along.pos] + area[along.size] - extents[along.high] + slack,
      ),
    ],
    cuts,
  );
}

/**
 * windows: front to back [{ windowId, rect, perch, foreground }]; areas: [{ id, rect, poses }]
 * where poses maps a template id to its poseExtents() or null. Windows in front hide the
 * edges behind them; the floor is only cut by the given occluders (the companion window).
 */
export function buildTerrain(windows, areas, { occluders = [], floors = true, slack = 0 } = {}) {
  const surfaces = [];
  const add = (template, rect, owner, area, blockers) => {
    const extents = area.poses[template.id];
    if (!extents) return;
    for (const [from, to] of edgeSpans(rect, template, extents, area.rect, blockers, slack))
      surfaces.push({ dock: template.dock, ...owner, areaId: area.id, rect, from, to });
  };
  windows.forEach(({ windowId, rect, perch, foreground }, index) => {
    if (!perch) return;
    const blockers = [...occluders, ...windows.slice(0, index).map((front) => front.rect)];
    for (const area of areas)
      for (const template of TERRAIN_TEMPLATES)
        add(template, rect, { windowId, foreground }, area, blockers);
  });
  if (floors)
    for (const area of areas)
      add(FLOOR, area.rect, { windowId: null, foreground: false }, area, occluders);
  return surfaces;
}

/** The dock, with its edge fraction, for a contact position along a surface. */
export function surfaceDock({ dock, rect }, position) {
  const { along } = edgeAxes(dock.edge);
  return { ...dock, fraction: (position - rect[along.pos]) / rect[along.size] };
}

/** Validated native avatar_surfaces windows; anything malformed is dropped, extra keys too. */
export function windowSurfaces(result) {
  if (result?.ok !== true || !Array.isArray(result.windows)) return null;
  return result.windows
    .filter(
      (entry) =>
        typeof entry?.windowId === 'string' &&
        /^\d{1,20}$/.test(entry.windowId) &&
        [entry.x, entry.y, entry.width, entry.height].every(Number.isSafeInteger) &&
        entry.width > 0 &&
        entry.height > 0 &&
        typeof entry.perch === 'boolean' &&
        typeof entry.foreground === 'boolean',
    )
    .slice(0, 32)
    .map(({ windowId, x, y, width, height, perch, foreground }) => ({
      windowId,
      rect: { x, y, width, height },
      perch,
      foreground,
    }));
}
