// SPDX-License-Identifier: GPL-3.0-only
// Real Electron settings and automatic teleports, using isolated data and a loopback fixture.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { _electron } from 'playwright-core';
import { root } from '../../packages/runtime/src/host/paths.mjs';
import { settingsView, saveSettings } from './settings-view.mjs';

const parent = path.join(root, '.runtime/desktop-verification');
mkdirSync(parent, { recursive: true });
const folder = mkdtempSync(path.join(parent, 'avatar-roaming-'));
const report = { passed: false, errors: [], checks: [] };
const server = createServer((_request, response) => {
  response.setHeader('content-type', 'application/json');
  response.end('{"data":[]}');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const env = {
  ...process.env,
  CAPRI_DESKTOP_VERIFICATION_DIR: folder,
  CAPRI_DESKTOP_VERIFICATION_PORT: String(server.address().port),
  CAPRI_DESKTOP_VERIFICATION_SKIP_START: '1',
  CAPRI_DESKTOP_VERIFICATION_MOCK_PACKS: '0',
};
delete env.ELECTRON_RUN_AS_NODE;
// Two external app windows to sit on: Capri's own windows are never roaming surfaces.
const fixtureScript = `Add-Type -AssemblyName System.Windows.Forms
$forms = foreach ($x in 240, 820) {
  $form = New-Object System.Windows.Forms.Form
  $form.Text = 'Capri roaming fixture'
  $form.StartPosition = 'Manual'
  $form.Bounds = New-Object System.Drawing.Rectangle($x, 320, 520, 380)
  $form.Show()
  $form
}
[System.Windows.Forms.Application]::Run($forms[0])`;
let application, fixtures;
try {
  fixtures = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', fixtureScript], {
    windowsHide: true,
    stdio: 'ignore',
  });
  await new Promise((resolve) => setTimeout(resolve, 2000));
  application = await _electron.launch({
    executablePath: createRequire(import.meta.url)('electron'),
    args: [path.join(root, 'apps/desktop/main.mjs'), '--verification'],
    env,
    timeout: 60000,
  });
  application.on('window', (page) =>
    page.on('pageerror', (error) => report.errors.push(error.message)),
  );
  const owner = await application.firstWindow();
  await owner.waitForFunction(() => document.body.dataset.phase === 'ready');
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((item) => item.webContents.getURL() === 'capri://desktop/index.html')
      .showInactive();
  });
  await owner.waitForFunction(() => Boolean(document.querySelector('#sprite').dataset.avatar));
  await owner.evaluate(() => {
    window.__roamingPhases = [];
    window.capri.onEvent((event) => {
      if (event.type === 'avatar.detach') window.__roamingPhases.push(event.phase);
    });
  });
  // Desktop roaming lives under Skills → Avatar interaction.
  const settings = await settingsView(application, 'avatar-skill');
  assert.equal(await settings.locator('#avatar-roaming').isChecked(), false);
  assert.equal(await settings.locator('#avatar-roam-interval').isDisabled(), true);
  assert.equal(await settings.locator('#avatar-roam-windows').isDisabled(), true);
  assert.equal(await settings.locator('#avatar-roam-windows').isChecked(), false);
  await settings.locator('#avatar-roaming').check();
  assert.equal(await settings.locator('#avatar-roam-windows').isDisabled(), false);
  await settings.locator('#avatar-roam-windows').check();
  await settings.locator('#avatar-roam-interval').evaluate((input) => {
    input.value = '30';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await settings.locator('#avatar-roam-interval-value').textContent(), '30 s');
  await settings.locator('[data-companion-group="Desktop roaming"]').scrollIntoViewIfNeeded();
  await settings.screenshot({ path: path.join(folder, 'roaming-settings.png') });
  await saveSettings(settings);
  await settings.locator('#settings-window-close').click();
  console.log('Waiting for the first scheduled teleport (30–36 s).');
  await owner.waitForFunction(() => window.__roamingPhases.includes('detached'), null, {
    timeout: 45000,
  });
  report.checks.push(
    'Enabled roaming leaves the home frame automatically without screen observation.',
  );
  // The next move may glide along the same edge, which plays no teleport phase, and
  // landing on the active window doubles the pause: wait, then read the decision log.
  console.log('Waiting for the next scheduled move (30–72 s).');
  await new Promise((resolve) => setTimeout(resolve, 80000));
  const reopened = await settingsView(application, 'avatar-skill');
  const { roaming } = await reopened.evaluate(() => window.capri.developerDiagnostics());
  const moves = roaming.decisions.filter(({ result }) => result !== 'perch failed');
  assert.ok(moves.length >= 2, JSON.stringify(roaming.decisions));
  report.checks.push('A second automatic move completes using the selected interval.');
  assert.ok(
    moves.some(({ kind }) => kind !== 'free'),
    JSON.stringify(moves),
  );
  assert.ok(
    roaming.decisions.every((decision) =>
      Object.values(decision).every(
        (value) => typeof value !== 'string' || !value.includes('fixture'),
      ),
    ),
  );
  report.checks.push('Roaming lands on app windows or the taskbar and logs no window titles.');
  assert.equal(await reopened.locator('#avatar-roaming').isChecked(), true);
  assert.equal(await reopened.locator('#avatar-roam-interval').inputValue(), '30');
  assert.equal(await reopened.locator('#avatar-roam-windows').isChecked(), true);
  await reopened.locator('#avatar-roaming').uncheck();
  assert.equal(await reopened.locator('#avatar-roam-interval').isDisabled(), true);
  assert.equal(await reopened.locator('#avatar-roam-windows').isDisabled(), true);
  await saveSettings(reopened);
  await reopened.locator('#settings-window-close').click();
  const state = await owner.evaluate(() => window.capri.bootstrap());
  assert.equal(state.companion.avatarRoaming, false);
  assert.equal(state.companion.avatarRoamWindows, true);
  report.checks.push('Settings persist and roaming can be disabled again.');
  assert.deepEqual(report.errors, []);
  report.passed = true;
} finally {
  writeFileSync(path.join(folder, 'report.json'), JSON.stringify(report, null, 2));
  fixtures?.kill();
  await application?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
console.log(JSON.stringify({ ...report, folder }));
