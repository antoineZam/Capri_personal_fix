---
name: capri-evolution
description: Implement an improvement, feature or bug fix in the user's Capri fork end to end - frame it, branch, write a failing test first, change the code, verify against a base, make atomic single-line commits, fast-forward main, push to the private fork, then record it in the Obsidian vault. Use for any request to improve, fix, add or implement something in Capri (améliorer, corriger, ajouter, implémenter, faire évoluer le bot), including the desktop-roaming plan steps and avatar or desktop behaviour changes.
---

# Capri evolution workflow

Follow these steps in order. The Git rules in `CLAUDE.md` always apply.

## 1. Frame the change

- Restate the goal and the user-visible result in one or two sentences.
- If it is a desktop-roaming plan step, first read its note in the vault (`%USERPROFILE%\Documents\Obsidian Vault\Perso\Informatique\Capri Roaming\Etapes\`) and the plan note. Follow it; write down any deviation and why.
- Locate the code with Grep before reading. `apps/desktop/main.mjs` is about 8,300 lines: read only the regions you need.
- Check `docs/` for the feature's contract (for example `docs/desktop-roaming.md`) and keep it true.

## 2. Branch from an up-to-date main

```bash
git -C E:/git/CapriCore fetch origin
git -C E:/git/CapriCore switch main
git -C E:/git/CapriCore merge --ff-only origin/main
git -C E:/git/CapriCore switch -c feat/<slug>
```

Use `fix/<slug>` for bug fixes. Stop and tell the user if `main` has diverged from `origin/main`.

## 3. Test first

- Add or extend a `node:test` case under `tests/` that captures the expected behaviour.
- Run it with Node 24 and confirm it fails on the current code for the right reason (skill `capri-test`). A test that already passes proves nothing.
- Pure modules are the easiest to test; for logic buried in `main.mjs`, extract a small pure helper into a module first.

## 4. Implement

- Smallest change that makes the test pass, in the existing style: ES modules, 2-space indent, single quotes, print width 100, trailing commas. Comments only for a non-obvious reason.
- Respect the architecture rules (renderer without Node, runtime without Electron, credentials never in renderer or model data).
- Behaviour changes that users may not want ship opt-in or behind the existing setting, with reduced motion respected.
- Never write absolute user-profile paths or the machine name into tracked files.

## 5. Verify

- `capri-test`: run the touched test files plus related suites and compare with `main` (`compare-tests.mjs --base main ...`). No new failure is allowed.
- Formatting: `npx --yes prettier@3.6.2 --check <changed files>`; if needed, `--write`, then check the diff only touches your lines.
- Large files: `"$LOCALAPPDATA/Programs/Capri/.runtime/node-v24.22.1-win-x64/node.exe" --check apps/desktop/main.mjs`.
- Native C# changes: compile with `csc.exe` using the arguments in `integrations/desktop-actions/provision.mjs`, output to a temporary folder.
- Anything that needs the real app (avatar placement, windows, voice) cannot be proven by unit tests: list it as a manual check for the user.

## 6. Commit

- One logical change per commit, single-line English message, no body, no trailer.
- Amend only your own unpushed commits.

## 7. Merge and push

```bash
git -C E:/git/CapriCore switch main
git -C E:/git/CapriCore merge --ff-only feat/<slug>
git -C E:/git/CapriCore push origin main
git -C E:/git/CapriCore branch -d feat/<slug>
```

Never push to `upstream`, never force-push. Leave the clone on `main` and clean.

## 8. Deploy (only if the user wants it now)

Use skill `capri-deploy`; it restarts the user's Capri.

## 9. Record in the vault (French)

- Step notes: set `statut`, add or extend "Réalisation" with a commits table (sha and message), deviations, verification done, and what was not verified.
- Plan note: update the "Avancement" table.
- A new topic gets its own note in `Perso/Informatique/` (or a folder plus a line in `Accueil.md`). Follow the vault conventions in `CLAUDE.md`. Never run git in the vault.

## 10. Report to the user

What changed, the commits, what was verified, what was not (especially checks in the running app), and whether it is deployed.
