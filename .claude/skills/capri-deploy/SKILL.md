---
name: capri-deploy
description: Install the fork's main into the user's locally installed Capri and restart it, verify it started cleanly, or roll back to the official files. Use when the user asks to deploy, install, update or restart their Capri (déployer, mettre à jour mon Capri, relancer Capri), or after a change they want to try now.
---

# Deploying to the installed Capri

The user's daily Capri is installed in `%LOCALAPPDATA%\Programs\Capri` (launcher `Capri.exe`, user data in `data\`). Its in-app updater only installs official CapriChooms releases, so personal changes are copied in with `%USERPROFILE%\.capri-sync\update-capri.ps1`. The script needs no Claude.

## Before deploying

- Only deploy when the user asked for it: it closes and restarts their Capri.
- `main` must contain the change, be pushed, and the clone must be clean (the script refuses otherwise).

## Deploy

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.capri-sync\update-capri.ps1"
```

It fetches `origin/main`, fast-forwards `main`, closes Capri cleanly through `data\run\desktop.stop` (only if it is running), writes the files changed since 1.1.2 (`bb0c2d7`) into the installation (personal tooling such as `CLAUDE.md` and `.claude/` is skipped), removes any leftover stop file, and starts `Capri.exe`.

Other modes:

- Restart only: add `-Restart`.
- Back to the official 1.1.2 files: add `-Source bb0c2d7`.
- After an official update changed the installed version: add `-Base <commit of that release>` (see skill `capri-upstream` first).

## Verify

```powershell
$I = "$env:LOCALAPPDATA\Programs\Capri"
Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like "$I*" } | Group-Object Name | Select-Object Count, Name
Get-ChildItem "$I\logs\*.stderr.log" | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-5) } | Select-Object Name, Length
Get-ChildItem "$I\logs" -File | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-5) } | Select-String -Pattern 'error|exception|SyntaxError|TypeError|ReferenceError'
```

- Expect the launcher, the Electron main process and helpers; `llama-server` may start only on demand.
- The `*.stderr.log` files written since the restart should be empty, and the error scan should find nothing.
- Compare installed files with the commit when in doubt: `git -C E:/git/CapriCore show main:<path>` against the installed copy (SHA-256).
- Changed native helpers (`integrations/*/native/*.cs`) recompile themselves the first time they are used.
- Then give the user the manual checks that prove the change in the running app.

## Never

- Never modify or delete anything in the installation's `data\` folder.
- Never launch `node_modules\electron\dist\Capri.exe` directly.
- Never create `data\run\desktop.stop` while Capri is not running without removing it before the next start: Capri would quit right after launching.
