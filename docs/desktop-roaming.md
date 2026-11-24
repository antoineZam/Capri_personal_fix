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
