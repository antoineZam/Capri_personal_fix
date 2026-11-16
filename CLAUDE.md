# Capri — personal fork, improvement project

This repository is the user's **private fork of Capri**, a Windows desktop AI companion (Electron app, OpenClaw sessions and memory, local llama.cpp models, animated avatar). Work here improves the Capri the user runs every day. Reply to the user in their language (usually French). Code, comments and commit messages stay in English, like upstream.

## Git rules (mandatory)

- `origin` = github.com/antoineZam/Capri_personal_fix (private). The only push target.
- `upstream` = github.com/CapriChooms/CapriCore (official project). Fetch only: its push URL is deliberately `DISABLED-do-not-push-upstream`. Never change that, never push there, never open issues or pull requests upstream.
- `main` = official Capri 1.1.2 (`bb0c2d7`) plus the user's improvements. Never force-push, never rewrite pushed history.
- Commits are atomic (one logical change each) with a **single-line** English message in upstream's style (imperative sentence, e.g. "Keep the whole sprite clear of the companion window when roaming"). No body, no `Co-Authored-By`, no other trailer.
- Work on a branch (`fix/<slug>`, `feat/<slug>`), then `git merge --ff-only` into `main` and `git push origin main`.
- Leave `E:\git\CapriCore` on `main` with a clean working tree at the end of every session: the daily sync skips the day otherwise.
- Tracked files must never contain absolute paths under the user profile (`C:\Users\<name>\...`) or the machine name: Capri's source-export check (`tools/release/source-export.mjs`) rejects them. Write `%USERPROFILE%`, `%LOCALAPPDATA%` or `~` instead.

## The installed Capri (what the user actually runs)

- Installed in `%LOCALAPPDATA%\Programs\Capri`; launch it with `Capri.exe` there (never `node_modules\electron\dist\Capri.exe`).
- The user's data (memory, workspace, settings, voices, models, secrets) lives in that folder's `data\`. Never modify or delete it.
- Capri must keep working without Claude. The in-app updater only installs official CapriChooms releases, so personal changes are deployed with the Claude-free script `%USERPROFILE%\.capri-sync\update-capri.ps1` (skill `capri-deploy`). Deploy only when the user asks: it restarts their Capri.
- An official in-app update (1.1.3 and later) overwrites deployed files; see skill `capri-upstream` before adopting one.

## Daily upstream sync (runs without the Claude app)

- Windows Task Scheduler task `\Capri\Capri - synchro upstream`, every day at 08:00, runs `%USERPROFILE%\.capri-sync\run-sync.ps1`, which starts the Claude Code CLI headless with `%USERPROFILE%\.capri-sync\prompt.md` (mode `dontAsk`, allow-list).
- It cherry-picks only the upstream commits that improve the fork, tracks progress with the local ref `refs/sync/upstream-reviewed`, pushes `main` to `origin`, and logs every decision in the vault note "Capri - Synchronisation upstream". Logs: `%USERPROFILE%\.capri-sync\logs`.
- If this file is loaded inside that unattended run, `prompt.md` takes precedence over everything here.
- Status, manual runs and reviewing "à revoir" commits: skill `capri-upstream`.

## Codebase map

- `apps/desktop/`: Electron app. `main.mjs` is the main-process orchestrator (about 8,300 lines: read regions, never the whole file). `main/` holds controllers (`avatar-detach.mjs` overlay, landing and teleport; `desktop-teleport-menu.mjs` native window follower). `renderer/` is the sandboxed UI (no Node imports).
- `packages/`: `runtime` (configuration, processes, atomic JSON; imports no Electron), `skills` (built-in skills, including avatar commands), `core`, `updater`, `installer`, `skill-sdk`.
- `integrations/`: native C# helpers compiled at runtime by .NET Framework `csc.exe` and keyed by source hash (`desktop-actions`, `awareness`, `spotify`), plus isolated Python workers (speech, voice, request router, music).
- `config/`, `assets/`, `docs/` (start with `docs/README.md`, `docs/architecture.md`, `docs/REFACTORING.md`; desktop roaming in `docs/desktop-roaming.md`), `tests/` (`node:test`), `tools/verify/` (real-Windows verifiers), `tools/checks/`.
- Architecture rules enforced by `tools/checks/source.mjs`: the renderer never imports Node, `packages/runtime` never imports Electron, credentials never reach the renderer or model data.

## Environment on this machine

- System Node is 22 but the repo needs Node 24: use Capri's bundled Node, `%LOCALAPPDATA%\Programs\Capri\.runtime\node-v24.22.1-win-x64\node.exe` (Git Bash: `"$LOCALAPPDATA/Programs/Capri/.runtime/node-v24.22.1-win-x64/node.exe"`).
- npm dependencies are not installed in the clone, so about 37 tests fail for environmental reasons. Always judge a change against a base ref, never by the raw failure count (skill `capri-test`).
- Formatting: `npx --yes prettier@3.6.2 --check <files>` (the version pinned in `package.json`); CI runs `format:check`.
- Native C#: compile-check with the same `csc.exe` arguments as `integrations/desktop-actions/provision.mjs`, output to a temporary folder.
- The GitHub CLI is not installed. The Claude Code CLI is `%USERPROFILE%\.local\bin\claude.exe` (not on PATH).

## Notes and roadmap (Obsidian vault)

- Vault: `%USERPROFILE%\Documents\Obsidian Vault`, synced by the Obsidian Git plugin. Only write files there; never run git in the vault unless the user asks.
- Conventions: French content, file names without accents, YAML frontmatter (`tags`, `projet`, `depot`, `date`, `statut`), `[[wikilinks]]`, one folder per topic with a hub note, and a line in `Accueil.md` when a folder is added.
- Capri notes live in `Perso/Informatique/`: "Capri - Guide d'utilisation", "Capri - Synchronisation upstream", and `Capri Roaming/` ("Capri Roaming - Diagnostic", "Capri Roaming - Plan de correction", step notes in `Etapes/`).
- Current roadmap, the desktop-roaming plan: step 1 is done (merged and deployed on 2026-11-15; manual checks in the app still pending), steps 2 to 8 are to do. Each step note lists files, changes, a code sketch and acceptance checks; follow it and record any deviation.
- When a change lands, update the step note (`statut` and a "Réalisation" section: commits, deviations, what was and was not verified) and the plan's "Avancement" table.

## Skills in this project

- `capri-evolution`: implement an improvement end to end (branch, test first, verify, atomic commits, merge, push, notes).
- `capri-test`: run the right tests with Node 24 and compare against a base ref (`scripts/compare-tests.mjs`).
- `capri-deploy`: install `main` into the local Capri, restart it, check the logs, roll back.
- `capri-upstream`: daily sync status, manual runs, reviewing upstream commits, adopting an official release.
