#!/usr/bin/env node
// Richtet das EnvSwitch-Hilfsprogramm für Chrome (und Edge, Brave, Chromium) ein.
//   node install.js <Extension-ID>            einrichten (ID steht in den EnvSwitch-Einstellungen)
//   node install.js <ID1> <ID2>               mehrere IDs erlauben
//   node install.js --uninstall               wieder entfernen
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const NAME = 'com.envswitch.vcs';
const here = __dirname;
const args = process.argv.slice(2);
const uninstall = args.includes('--uninstall');
const ids = args.filter(a => /^[a-p]{32}$/.test(a));
const bad = args.filter(a => !a.startsWith('--') && !/^[a-p]{32}$/.test(a));

if (bad.length) {
  console.error(`Das ist keine gültige Extension-ID: ${bad.join(', ')}\nDie ID (32 Buchstaben a–p) steht in EnvSwitch unter Einstellungen.`);
  process.exit(1);
}

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const home = os.homedir();

// Ordner, in denen Chrome & Co. nach Native-Messaging-Hosts suchen (Mac und Linux)
const dirs = isMac
  ? ['Google/Chrome', 'Google/Chrome Beta', 'Chromium', 'Microsoft Edge', 'BraveSoftware/Brave-Browser', 'Arc/User Data'].map(b => path.join(home, 'Library/Application Support', b, 'NativeMessagingHosts'))
  : ['google-chrome', 'google-chrome-beta', 'chromium', 'microsoft-edge', 'BraveSoftware/Brave-Browser'].map(b => path.join(home, '.config', b, 'NativeMessagingHosts'));
const regKeys = ['Google\\Chrome', 'Microsoft\\Edge', 'Chromium', 'BraveSoftware\\Brave-Browser'].map(b => `HKCU\\Software\\${b}\\NativeMessagingHosts\\${NAME}`);
const launcher = path.join(here, isWin ? 'envswitch-host.bat' : 'envswitch-host.sh');
const winManifest = path.join(here, `${NAME}.json`);

if (uninstall) {
  if (isWin) for (const k of regKeys) try { execFileSync('reg', ['delete', k, '/f'], { stdio: 'ignore' }); } catch {}
  else for (const d of dirs) fs.rmSync(path.join(d, `${NAME}.json`), { force: true });
  fs.rmSync(winManifest, { force: true });
  fs.rmSync(launcher, { force: true });
  console.log('EnvSwitch-Hilfsprogramm entfernt.');
  process.exit(0);
}

if (!ids.length) {
  console.error('Bitte die Extension-ID angeben: node install.js <ID>\nDie ID steht in EnvSwitch unter Einstellungen → Branch Manager.');
  process.exit(1);
}

// Bisher erlaubte IDs behalten (z. B. Arbeits- und Privat-Chrome)
const known = new Set(ids);
for (const f of [winManifest, ...dirs.map(d => path.join(d, `${NAME}.json`))]) {
  try {
    for (const o of JSON.parse(fs.readFileSync(f, 'utf8')).allowed_origins ?? []) {
      const id = /^chrome-extension:\/\/([a-p]{32})\/$/.exec(o)?.[1];
      if (id) known.add(id);
    }
  } catch {}
}

// Starter mit festem Pfad zu Node, weil Chrome Programme mit sehr knappem PATH startet
const hostJs = path.join(here, 'host.js');
if (isWin) {
  fs.writeFileSync(launcher, `@echo off\r\n"${process.execPath}" "%~dp0host.js" %*\r\n`);
} else {
  fs.writeFileSync(launcher, `#!/bin/sh\n# Chrome startet mit knappem PATH: übliche Orte für git und hg ergänzen\nexport PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin"\nexec "${process.execPath}" "${hostJs}" "$@"\n`);
  fs.chmodSync(launcher, 0o755);
}

const manifest = {
  name: NAME,
  description: 'EnvSwitch Branch Manager (git und hg)',
  path: launcher,
  type: 'stdio',
  allowed_origins: [...known].map(id => `chrome-extension://${id}/`),
};

const written = [];
if (isWin) {
  fs.writeFileSync(winManifest, JSON.stringify(manifest, null, 2));
  for (const k of regKeys) {
    try {
      execFileSync('reg', ['add', k, '/ve', '/t', 'REG_SZ', '/d', winManifest, '/f'], { stdio: 'ignore' });
      written.push(k);
    } catch {}
  }
} else {
  for (const d of dirs) {
    // Nur Browser, die installiert sind (deren Profilordner existiert)
    if (!fs.existsSync(path.dirname(d))) continue;
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, `${NAME}.json`), JSON.stringify(manifest, null, 2));
    written.push(d);
  }
}

if (!written.length) {
  console.error('Kein Chrome-Profilordner gefunden. Ist Chrome installiert und schon einmal gestartet worden?');
  process.exit(1);
}
console.log(`EnvSwitch-Hilfsprogramm eingerichtet für ${known.size === 1 ? 'Extension' : 'Extensions'} ${[...known].join(', ')}`);
console.log(written.map(w => `  ✓ ${w}`).join('\n'));
console.log('\nFertig. In EnvSwitch unter Einstellungen auf „Verbindung prüfen“ klicken.');
console.log('Wichtig: Diesen Ordner nicht verschieben. Falls doch, install.js nochmals ausführen.');
