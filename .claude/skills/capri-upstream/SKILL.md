---
name: capri-upstream
description: Check or operate the daily selective sync of official Capri into the private fork - task status, logs, journal, manual runs, pausing, reviewing upstream commits marked "à revoir", re-authenticating the CLI, and adopting an official Capri release. Use for questions about the synchro, upstream, CapriChooms updates, the journal, or a new official Capri version.
---

# Daily upstream sync

## How it works

- Windows Task Scheduler task `\Capri\Capri - synchro upstream` runs every day at 08:00 (and as soon as the session opens if the PC was off). It needs no Claude app.
- It runs `%USERPROFILE%\.capri-sync\run-sync.ps1`, which pipes `%USERPROFILE%\.capri-sync\prompt.md` into `%USERPROFILE%\.local\bin\claude.exe -p --permission-mode dontAsk` with an allow-list (git, Node 24 tests, Prettier check, repo files, the journal note).
- Upstream commits after the local ref `refs/sync/upstream-reviewed` are judged one by one; only improvements are cherry-picked (no `-x`, single-line messages), tested against their parent, and pushed to `origin/main`.
- Every decision is logged, newest first, in the vault note `Perso/Informatique/Capri - Synchronisation upstream.md`. Run logs: `%USERPROFILE%\.capri-sync\logs\`.
- The in-app scheduled task `capri-upstream-sync` is paused and replaced by the Windows task.

## Status

```powershell
Get-ScheduledTask -TaskPath '\Capri\' -TaskName 'Capri - synchro upstream' | Get-ScheduledTaskInfo | Select-Object LastRunTime, LastTaskResult, NextRunTime
Get-ChildItem "$env:USERPROFILE\.capri-sync\logs\*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content -Encoding UTF8
git -C E:/git/CapriCore log --oneline refs/sync/upstream-reviewed..upstream/main
```

`LastTaskResult` 0 means the run finished; read the log and the journal for what it decided.

## Run, pause, resume

```powershell
Start-ScheduledTask -TaskPath '\Capri\' -TaskName 'Capri - synchro upstream'
Disable-ScheduledTask -TaskPath '\Capri\' -TaskName 'Capri - synchro upstream'
Enable-ScheduledTask -TaskPath '\Capri\' -TaskName 'Capri - synchro upstream'
```

A run skips the day if `E:\git\CapriCore` is not on a clean `main`. Leave the clone that way at the end of every session.

## Review a commit marked "à revoir"

1. `git -C E:/git/CapriCore show --stat <sha>` then the diff; explain to the user what it does and how it interacts with the personal changes.
2. If the user wants it: on a branch, `git cherry-pick <sha>` (no `-x`), keep only the subject line, resolve conflicts so personal fixes keep working, verify with skill `capri-test`, fast-forward `main`, push to `origin`.
3. Update that row in the journal note (French): new decision, reason, local commit.
   The marker ref already points past reviewed commits; never move it backwards.

## The CLI lost its sign-in

The log shows an authentication error. The user signs in again themselves:

```powershell
& "$env:USERPROFILE\.local\bin\claude.exe" auth login
```

## Adopting an official Capri release (1.1.3 and later)

The fork's `main` holds only the upstream commits judged useful, while an official in-app update installs the whole release and overwrites deployed files. Before the user updates Capri from inside the app, agree on one of these:

- **Stay on the fork**: skip the in-app update; keep deploying `main` with `update-capri.ps1`.
- **Fork-only settings**: the fork adds companion settings that official Capri does not know (`avatarRoamWindows`). Official builds reject unknown companion keys, so after an official in-app update every companion setting falls back to its default (Settings shows "Saved settings could not be restored"), and the next save in Settings makes that permanent. Redeploy the fork right after updating, or have the user remove those keys from `data\desktop\companion.json` in the installation before Capri saves anything.
- **Adopt the release**: merge the release commit into `main` on a branch (`git merge <release commit>`; this brings every upstream change), resolve conflicts in favour of the personal fixes, verify, fast-forward `main`, push, set `refs/sync/upstream-reviewed` to the release commit, update the installation (in-app update or installer), then redeploy with `update-capri.ps1 -Base <release commit>`. Record the change of base in the journal and in `CLAUDE.md` (the `bb0c2d7` references).

## Never

- Never push to `upstream`, change its push URL, or open issues or pull requests there.
- Never run git in the Obsidian vault unless the user asks.
