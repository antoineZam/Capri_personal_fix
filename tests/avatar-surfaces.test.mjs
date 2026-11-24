// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const harness = `using System;
using System.Collections.Generic;
using System.Drawing;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Windows.Forms;
class Fixture : Form {
    readonly int extra;
    public Fixture(string text, int x, int y, int width, int height, int extra) {
        this.extra = extra;
        Text = text; FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.Manual;
        Bounds = new Rectangle(x, y, width, height); TopMost = true; ShowInTaskbar = false;
    }
    protected override CreateParams CreateParams {
        get { var value = base.CreateParams; value.ExStyle |= extra; return value; }
    }
}
class SurfacesHarness {
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    static int Main(string[] args) {
        try {
            SetProcessDpiAwarenessContext(new IntPtr(-4));
            var a = new Fixture("fixture", 200, 200, 400, 300, 0);
            var b = new Fixture("front", 100, 150, 300, 200, 0);
            var tool = new Fixture("tool", 700, 200, 200, 150, 0x80);
            var through = new Fixture("through", 700, 400, 200, 150, 0x80020);
            var small = new Fixture("small", 950, 200, 120, 80, 0);
            foreach (var form in new Form[] { a, b, tool, through, small }) form.Show();
            // Keep B in front of A whatever the foreground rules allow.
            SetWindowPos(a.Handle, b.Handle, 0, 0, 0, 0, 0x13);
            for (int i = 0; i < 20; i++) { Application.DoEvents(); System.Threading.Thread.Sleep(10); }
            var type = Assembly.LoadFrom(args[0]).GetType("DesktopActions", true);
            Func<string, Dictionary<string, object>, object> call = (name, query) =>
                type.GetMethod(name, BindingFlags.Static | BindingFlags.NonPublic).Invoke(null, new object[] { query });
            Func<Form, string> id = form => form.Handle.ToInt64().ToString();
            var output = new Dictionary<string, object> {
                { "surfaces", call("AvatarSurfaces", new Dictionary<string, object> { { "ignoreProcessId", "0" } }) },
                { "window", call("AvatarWindow", new Dictionary<string, object> { { "windowId", id(a) }, { "ignoreProcessId", "0" } }) },
                { "ids", new Dictionary<string, object> { { "a", id(a) }, { "b", id(b) }, { "tool", id(tool) }, { "through", id(through) }, { "small", id(small) } } },
            };
            Console.WriteLine(new JavaScriptSerializer().Serialize(output));
            return 0;
        } catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}`;

test(
  'window surfaces list geometry only, front to back, with perch flags',
  { skip: process.platform !== 'win32', timeout: 60000 },
  () => {
    const parent = path.resolve('.runtime/test-data/avatar-surfaces');
    mkdirSync(parent, { recursive: true });
    const folder = mkdtempSync(path.join(parent, 'fixture-'));
    const framework = path.join(
      process.env.SystemRoot ?? 'C:\\Windows',
      'Microsoft.NET/Framework64/v4.0.30319',
    );
    const references = [
      'System.Web.Extensions.dll',
      'Microsoft.CSharp.dll',
      'System.Windows.Forms.dll',
      'System.Drawing.dll',
      ...['UIAutomationClient', 'UIAutomationTypes', 'WindowsBase'].map((name) =>
        path.join(framework, 'WPF', name + '.dll'),
      ),
    ];
    const compile = (source, target, library = false) => {
      const result = spawnSync(
        path.join(framework, 'csc.exe'),
        [
          '/nologo',
          '/target:' + (library ? 'library' : 'exe'),
          '/platform:x64',
          '/optimize+',
          '/out:' + target,
          ...references.map((value) => '/r:' + value),
          source,
        ],
        { windowsHide: true, encoding: 'utf8', timeout: 20000 },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
    };
    const library = path.join(folder, 'DesktopActions.dll');
    compile(path.resolve('integrations/desktop-actions/native/DesktopActions.cs'), library, true);
    const source = path.join(folder, 'SurfacesHarness.cs');
    writeFileSync(source, harness);
    const executable = path.join(folder, 'SurfacesHarness.exe');
    compile(source, executable);
    const run = spawnSync(executable, [library], { encoding: 'utf8', timeout: 20000 });
    assert.equal(run.status, 0, run.stderr);
    const { surfaces, window, ids } = JSON.parse(run.stdout);

    assert.equal(surfaces.ok, true);
    assert.ok(surfaces.windows.length <= 32);
    const keys = ['foreground', 'height', 'perch', 'width', 'windowId', 'x', 'y'];
    for (const entry of surfaces.windows) {
      assert.deepEqual(Object.keys(entry).sort(), keys);
      assert.match(entry.windowId, /^\d+$/);
      for (const value of [entry.x, entry.y, entry.width, entry.height])
        assert.ok(Number.isSafeInteger(value));
      assert.equal(typeof entry.perch, 'boolean');
      assert.equal(typeof entry.foreground, 'boolean');
    }
    assert.ok(surfaces.windows.filter((entry) => entry.foreground).length <= 1);

    const index = (key) => surfaces.windows.findIndex((entry) => entry.windowId === ids[key]);
    const a = surfaces.windows[index('a')];
    assert.ok(a, 'the fixture window is listed');
    assert.equal(a.perch, true);
    for (const [key, value] of Object.entries({ x: 200, y: 200, width: 400, height: 300 }))
      assert.ok(Math.abs(a[key] - value) <= 1, key);
    assert.ok(index('b') >= 0 && index('b') < index('a'), 'the front window comes first');
    assert.equal(surfaces.windows[index('tool')]?.perch, false);
    assert.equal(surfaces.windows[index('small')]?.perch, false);
    assert.equal(index('through'), -1, 'click-through overlays are omitted');

    assert.equal(window.windowId, ids.a);
    assert.deepEqual(
      [window.x, window.y, window.width, window.height],
      [a.x, a.y, a.width, a.height],
    );
  },
);
