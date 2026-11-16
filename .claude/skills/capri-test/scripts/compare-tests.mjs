// Runs the same node:test files on the working tree and on a base ref, then
// reports only the differences. Run it with Node 24 from the repository root:
//   node .claude/skills/capri-test/scripts/compare-tests.mjs [--base <ref>] <test files...>
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const at = args.indexOf('--base');
let base = at >= 0 ? args[at + 1] : null;
const files = args.filter((value, index) => at < 0 || (index !== at && index !== at + 1));
if (!files.length) {
  console.error('Usage: compare-tests.mjs [--base <ref>] <test files...>');
  process.exit(2);
}

const git = (...parameters) =>
  execFileSync('git', parameters, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const root = git('rev-parse', '--show-toplevel');
if (!base) base = git('rev-parse', 'HEAD') === git('rev-parse', 'main') ? 'HEAD~1' : 'main';
const baseSha = git('rev-parse', '--short', base);

function failures(cwd) {
  const present = files.filter((file) => {
    try {
      execFileSync('git', ['-C', cwd, 'ls-files', '--error-unmatch', file], { stdio: 'ignore' });
      return true;
    } catch {
      return cwd === root; // untracked new test files still run on the working tree
    }
  });
  if (!present.length) return { failed: new Set(), passed: 0, ran: 0 };
  const result = spawnSync(
    process.execPath,
    ['--test', '--test-reporter=tap', '--test-concurrency=4', ...present],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true },
  );
  const lines = (result.stdout ?? '').split(/\r?\n/);
  const failed = new Set();
  let passed = 0;
  for (const line of lines) {
    const bad = /^\s*not ok \d+ - (.+?)(?:\s+#.*)?$/.exec(line);
    if (bad) failed.add(bad[1].trim());
    else if (/^\s*ok \d+ - /.test(line)) passed++;
  }
  return { failed, passed, ran: present.length };
}

const directory = mkdtempSync(path.join(tmpdir(), 'capri-compare-'));
let baseResult;
try {
  git('worktree', 'add', '--quiet', '--detach', directory, base);
  baseResult = failures(directory);
} finally {
  try {
    git('worktree', 'remove', '--force', directory);
  } catch {}
  rmSync(directory, { recursive: true, force: true });
  try {
    git('worktree', 'prune');
  } catch {}
}
const current = failures(root);

const added = [...current.failed].filter((name) => !baseResult.failed.has(name));
const fixed = [...baseResult.failed].filter((name) => !current.failed.has(name));
console.log(
  `Base ${base} (${baseSha}): ${baseResult.failed.size} failing, ${baseResult.passed} passing`,
);
console.log(`Working tree: ${current.failed.size} failing, ${current.passed} passing`);
if (fixed.length)
  console.log('\nFixed or new and passing:\n' + fixed.map((n) => '  + ' + n).join('\n'));
if (added.length) {
  console.log('\nNEW FAILURES (regressions):\n' + added.map((n) => '  - ' + n).join('\n'));
  process.exit(1);
}
console.log('\nNo new failures.');
