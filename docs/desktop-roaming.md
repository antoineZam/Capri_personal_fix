# Desktop roaming

Open **Settings → Skills → Avatar interaction → Desktop roaming**.

- **Let Capri move around on her own** enables automatic lightning teleports. It is off by default, including when upgrading existing settings.
- **Time between moves** selects a minimum interval from 30 seconds to 30 minutes. The default is two minutes. Actual pauses vary by up to 20% so movement feels less mechanical.
- **Let Capri sit on app windows** lets roaming perch on the edges of open app windows. It is off by default and needs roaming to be on.

Random movement stays on her current display and uses desktop geometry without
capturing the screen or calling a model. Sitting on app windows is a separate
opt-in: it reads window positions and sizes only, never screen pixels, window
titles or window contents. Screen observation is not needed for it; when you
observe a window or monitors, Capri can also perch on the observed window and use
the approved displays, and a perch made under observation ends when observation
stops. Screen access is never enabled automatically.

With app windows allowed, each move is planned over the surfaces that are
actually open on the display: one list of window frames, front to back, with
their ids and which one is in front. An edge hidden by a window in front of it,
or whose pose would leave the screen, is skipped. The plan draws among:

| Surface                                     | Base weight |
| ------------------------------------------- | ----------- |
| Top corner of a window (legs over the side) | 1.4         |
| Top edge of a window                        | 1.0         |
| Taskbar line (bottom of the work area)      | 0.8         |
| Side of a window, near its top              | 0.6         |
| Underside of a window                       | 0.3         |
| Free spot in the air                        | 0.25        |

The window in front counts 2.5 times, an observed window 3 times, a window used
in the last three moves 0.3 times, the same kind of surface as the last move 0.6
times, and a very short hop 0.2 times. A window never gets four moves in a row.
Up to three choices are tried per move; the free spot is the last resort, so a
move never stalls. Process identity is checked only for the window actually
chosen. Observing a window makes it the favourite, not the only destination.
Recent decisions appear in **Settings → Developer → For developers**.

Moves along the top edge of the window Capri sits on are glides: she slides to
the new spot with a light bob instead of teleporting (at most 1.5 seconds, no
lightning). Destinations closer than a quarter of the screen diagonal use a
quicker, smaller teleport; farther ones keep the full one. When she lands on
the window in front, the next pause is twice as long. Reduced motion and the
dialogue presentation skip glides and short hops: she is placed instantly or
uses the reduced teleport, as before. Grabbing her mid-glide stops her where
she is, and a moving window takes over from a glide.

Once seated, Capri follows her window as it moves. If the pose no longer fits
(for example after snapping the window to the top of the screen), she moves to
the nearest dock of the same window that does, such as a corner or a side, and
leaves only when none fits. With app windows allowed, the follower also notices
windows that come in front of her: she slides to the nearest open part of the
edge, or hides and leaves after about two seconds if it stays covered. When the
window is closed, minimized or maximized, the next spot is planned like any
other move, so she lands on the taskbar or another window rather than in a
screen corner. With app windows not allowed, these cases keep the previous
free landing. If the native window follower cannot run, the perch keeps
following by checking its window every 1.8 seconds and the follower is
restarted up to three times.

Roaming pauses while Settings is open, while you type, speak, drag or interact
with Capri, during replies and voice playback, during computer control, while
Capri sleeps, in Focus mode, and when her host window is minimized. A short quiet
period follows interaction; missed moves do not accumulate. Manual teleports and
returning home restart the waiting period. Turning roaming off preserves manual
dragging and teleport controls, including following a window she is perched on.

Scheduling shares the existing desktop supervision tick and adds no timer or
background model loading. With roaming off and Capri at home, the tick does no
roaming work at all. A move with app windows allowed costs one window list and
one identity check for the chosen window; following a perch costs one fit check
per window update.

## Verification

Unit tests cover upgrade defaults, saved settings, interval and dwell rules, the
decision log, the window list (with real windows), open edges, corners and
floors, the planner's weights, preference and streak rule, mirrored poses, glides,
short hops, cover reporting by the native follower and the helper status:

```text
node --test tests/avatar-roaming.test.mjs tests/desktop-avatar-commands.test.mjs tests/desktop-avatar-detach.test.mjs tests/avatar-docking.test.mjs tests/avatar-terrain.test.mjs tests/avatar-roam-planner.test.mjs tests/avatar-surfaces.test.mjs tests/desktop-teleport-watch.test.mjs tests/developer-diagnostics.test.mjs
node tools/verify/verify-avatar-surfaces.mjs
node tools/verify/verify-avatar-roaming.mjs
```

`verify-avatar-surfaces` times the window list on the real desktop (no Electron
needed). `verify-avatar-roaming` drives the real settings with two external test
windows and checks that roaming reaches a window edge or the taskbar without
logging titles; it needs the Electron dependencies.

The native follower does not run under `--verification`, so these remain manual
checks in the running app: a window brought over a perch (slide, or leave within
about two seconds), maximizing or minimizing the occupied window (taskbar or
another window, never a screen corner), snapping it to the top half (corner,
side or leave, never over the title bar), mixed DPI displays, a left or
auto-hidden taskbar, reduced motion and the dialogue presentation (no glide or
short hop), the window-observation lease, and turning **Let Capri sit on app
windows** off (free hops only, as in Capri 1.1.2).
