// SPDX-License-Identifier: GPL-3.0-only
import { COMPANION_DEFAULTS } from './companion-settings.mjs';

/** Uses the existing desktop tick: no extra timer, model request or screen capture. */
export class AvatarRoaming {
  constructor({ now = Date.now, random = Math.random } = {}) {
    Object.assign(this, { now, random });
    this.nextAt = Infinity;
    this.revision = 0;
    // Recent decisions, newest first; epoch changes each time roaming is switched on.
    this.log = [];
    this.epoch = 0;
  }
  sync(settings) {
    const enabled = settings.avatarRoaming === true;
    const seconds =
      settings.avatarRoamIntervalSeconds ?? COMPANION_DEFAULTS.avatarRoamIntervalSeconds;
    if (enabled !== this.enabled || seconds !== this.seconds) {
      if (enabled && !this.enabled) this.epoch++;
      Object.assign(this, { enabled, seconds });
      this.revision++;
      this.nextAt = enabled ? this.now() + this.delay() : Infinity;
    }
  }
  delay() {
    // Never move more frequently than the selected interval; vary the pause slightly.
    return this.seconds * 1000 * (1 + this.random() * 0.2);
  }
  due(settings, { blocked = false } = {}) {
    this.sync(settings);
    if (!this.enabled) return false;
    // No queued burst, or surprise jump immediately after interaction/resume.
    if (blocked) this.nextAt = Math.max(this.nextAt, this.now() + 5000);
    return !blocked && this.now() >= this.nextAt;
  }
  /** A dwell factor can only lengthen the pause: the chosen interval stays a minimum. */
  postpone(settings, minimumMs = 0, dwell = 1) {
    this.sync(settings);
    this.revision++;
    if (this.enabled)
      this.nextAt = this.now() + Math.max(minimumMs, this.delay() * Math.max(1, dwell));
  }
  current(settings, revision) {
    this.sync(settings);
    return this.enabled && revision === this.revision;
  }
  record(entry) {
    this.log.unshift({ at: this.now(), epoch: this.epoch, ...entry });
    if (this.log.length > 20) this.log.length = 20;
  }
  /** Moves that happened since roaming was last switched on, newest first. */
  recent(count = 5) {
    return this.log
      .filter((entry) => entry.epoch === this.epoch && entry.result !== 'perch failed')
      .slice(0, count);
  }
  decisions() {
    return this.log.map((entry) => ({ ...entry }));
  }
}
