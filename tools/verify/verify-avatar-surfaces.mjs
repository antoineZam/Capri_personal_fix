// SPDX-License-Identifier: GPL-3.0-only
// Times the read-only avatar_surfaces query against the real desktop. It lists
// window frames only: nothing is captured, focused, moved or typed into.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { root } from '../../packages/runtime/src/host/paths.mjs';
import { callApplicationBridge } from '../../integrations/desktop-actions/service.mjs';
import { windowSurfaces } from '../../apps/desktop/avatar-terrain.mjs';

assert.equal(process.platform, 'win32', 'This optional verification requires Windows.');
const folder = path.join(root, '.runtime/avatar-surfaces');
mkdirSync(folder, { recursive: true });
mkdirSync(path.join(root, '.runtime/tmp'), { recursive: true });

const query = { action: 'avatar_surfaces', ignoreProcessId: String(process.pid) };
const timed = async () => {
  const start = performance.now();
  const result = await callApplicationBridge(root, query);
  return { result, ms: performance.now() - start };
};

const warm = await timed();
const runs = [];
for (let index = 0; index < 20; index++) runs.push(await timed());
const times = runs.map(({ ms }) => ms).sort((a, b) => a - b);
const quantile = (q) => times[Math.min(times.length - 1, Math.floor(q * times.length))];

const strings = [];
for (const { result } of [warm, ...runs])
  for (const entry of result.windows ?? [])
    for (const value of Object.values(entry)) if (typeof value === 'string') strings.push(value);
const windows = windowSurfaces(runs.at(-1).result);
const report = {
  firstMs: Math.round(warm.ms),
  minMs: Math.round(times[0]),
  p50Ms: Math.round(quantile(0.5)),
  p95Ms: Math.round(quantile(0.95)),
  maxMs: Math.round(times.at(-1)),
  windows: windows?.length ?? 0,
  perchable: windows?.filter(({ perch }) => perch).length ?? 0,
};
writeFileSync(path.join(folder, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));

assert.ok(windows, 'avatar_surfaces returns a valid result');
assert.equal(windows.length, runs.at(-1).result.windows.length, 'every entry is well formed');
assert.ok(
  strings.every((value) => /^\d+$/.test(value)),
  'window ids are the only strings',
);
assert.ok(report.p95Ms < 400, 'the query fits well within the 400 ms desktop tick');
