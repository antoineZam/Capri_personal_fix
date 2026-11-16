---
name: capri-test
description: Run Capri's tests correctly on this machine - with Capri's bundled Node 24, on the right test files, compared against a base ref so environmental failures are not mistaken for regressions. Use before committing any Capri change, when a test fails, or when asked to test, vérifier or lancer les tests.
---

# Testing Capri on this machine

## Facts

- The repo needs Node 24; the system Node is 22. Use Capri's bundled Node:
  - Git Bash: `"$LOCALAPPDATA/Programs/Capri/.runtime/node-v24.22.1-win-x64/node.exe"`
  - PowerShell: `& "$env:LOCALAPPDATA\Programs\Capri\.runtime\node-v24.22.1-win-x64\node.exe"`
- npm dependencies are not installed in the clone, so about 37 tests (installer, packaging, Electron and user-tools fixtures) fail for environmental reasons. They fail the same way on the untouched base. Never judge by the raw failure count.
- `npm test` (all files) needs installed dependencies; prefer targeted files.

## Choose the test files

- The files you touched, the `tests/*.test.mjs` that import the modules you changed (`grep -l "<module name>" tests/*.test.mjs`), plus related suites.
- Avatar, roaming and desktop work: `tests/desktop-avatar-detach.test.mjs tests/desktop-avatar-commands.test.mjs tests/avatar-roaming.test.mjs`, plus any `tests/*avatar*` or `tests/desktop*` file relevant to the change.

## Run a quick pass

```bash
"$LOCALAPPDATA/Programs/Capri/.runtime/node-v24.22.1-win-x64/node.exe" --test tests/desktop-avatar-detach.test.mjs
"$LOCALAPPDATA/Programs/Capri/.runtime/node-v24.22.1-win-x64/node.exe" --test --test-name-pattern="<part of a test name>" tests/<file>.test.mjs
```

## Compare against a base (the real verdict)

`scripts/compare-tests.mjs` runs the same files on the working tree and on a base ref (in a temporary git worktree it removes afterwards) and prints only the differences.

```bash
"$LOCALAPPDATA/Programs/Capri/.runtime/node-v24.22.1-win-x64/node.exe" .claude/skills/capri-test/scripts/compare-tests.mjs --base main tests/a.test.mjs tests/b.test.mjs
```

- `--base` defaults to `main`, or `HEAD~1` when the current commit is `main` itself.
- Exit code 0: no new failure. Exit code 1: the listed tests fail on the working tree but not on the base. That is a regression to fix.
- New tests that fail on the base and pass on the working tree are listed as fixed; that is the expected result for a test-first change.
- Run it from the repository root (`E:\git\CapriCore`). Uncommitted changes are included on the working-tree side.

## Test-first check

Before implementing, run the new test alone and confirm it fails for the expected reason (assertion message, missing export). After implementing, it must pass several times in a row if it involves randomness; measure how far below its threshold it sits so it cannot flake.
