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

Roaming pauses while Settings is open, while you type, speak, drag or interact
with Capri, during replies and voice playback, during computer control, while
Capri sleeps, in Focus mode, and when her host window is minimized. A short quiet
period follows interaction; missed moves do not accumulate. Manual teleports and
returning home restart the waiting period. Turning roaming off preserves manual
dragging and teleport controls, including following a window she is perched on.

Scheduling shares the existing desktop supervision tick and adds no timer or
background model loading. Verification covers upgrade defaults, saved settings,
interval changes, pauses, manual cooldowns and repeated automatic teleports:

```text
node --test tests/avatar-roaming.test.mjs tests/desktop-avatar-commands.test.mjs
node tools/verify/verify-avatar-roaming.mjs
```
