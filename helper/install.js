#!/usr/bin/env node
// Richtet das EnvSwitch-Hilfsprogramm für Chrome (und Edge, Brave, Chromium) ein.
//   npx github:wendelinstadler/envswitch <Extension-ID>   (empfohlen, ohne Repo)
//   node install.js <Extension-ID>                         (im Ordner helper)
//   … <ID1> <ID2>                                          mehrere IDs erlauben
//   … --uninstall                                          wieder entfernen
// Das Programm wird an einen festen Ort kopiert (~/.envswitch bzw. %LOCALAPPDATA%\EnvSwitch),
// damit es auch nach einem npx-Aufruf oder Verschieben des Repos weiter funktioniert.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const NAME = 'com.envswitch.vcs';
const args = process.argv.slice(2);
const uninstall = args.includes('--uninstall');
const ids = args.filter(a => /^[a-p]{32}$/.test(a));
const bad = args.filter(a => !a.startsWith('--') && !/^[a-p]{32}$/.test(a));

const de = /^de/i.test(process.env.LC_ALL || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || '');
const say = (deText, enText) => (de ? deText : enText);

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const home = os.homedir();
const target = isWin ? path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'EnvSwitch') : path.join(home, '.envswitch');

// Ordner, in denen Chrome & Co. nach Native-Messaging-Hosts suchen (Mac und Linux)
const dirs = isMac
  ? ['Google/Chrome', 'Google/Chrome Beta', 'Chromium', 'Microsoft Edge', 'BraveSoftware/Brave-Browser', 'Arc/User Data'].map(b => path.join(home, 'Library/Application Support', b, 'NativeMessagingHosts'))
  : ['google-chrome', 'google-chrome-beta', 'chromium', 'microsoft-edge', 'BraveSoftware/Brave-Browser'].map(b => path.join(home, '.config', b, 'NativeMessagingHosts'));
const regKeys = ['Google\\Chrome', 'Microsoft\\Edge', 'Chromium', 'BraveSoftware\\Brave-Browser'].map(b => `HKCU\\Software\\${b}\\NativeMessagingHosts\\${NAME}`);
const launcher = path.join(target, isWin ? 'envswitch-host.bat' : 'envswitch-host.sh');
const winManifest = path.join(target, `${NAME}.json`);
const manifests = isWin ? [winManifest] : dirs.map(d => path.join(d, `${NAME}.json`));

if (bad.length) {
  console.error(say(`Das ist keine gültige Extension-ID: ${bad.join(', ')}\nDie ID (32 Buchstaben a–p) steht in EnvSwitch unter Einstellungen.`, `Not a valid extension ID: ${bad.join(', ')}\nThe ID (32 letters a–p) is shown in EnvSwitch under Settings.`));
  process.exit(1);
}

if (uninstall) {
  if (isWin) for (const k of regKeys) try { execFileSync('reg', ['delete', k, '/f'], { stdio: 'ignore' }); } catch {}
  for (const f of manifests) fs.rmSync(f, { force: true });
  fs.rmSync(target, { recursive: true, force: true });
  console.log(say('EnvSwitch-Hilfsprogramm entfernt.', 'EnvSwitch helper removed.'));
  process.exit(0);
}

if (!ids.length) {
  console.error(say('Bitte die Extension-ID angeben, z. B.: npx github:wendelinstadler/envswitch <ID>\nDie ID steht in EnvSwitch unter Einstellungen → Branch Manager.', 'Please pass the extension ID, e.g.: npx github:wendelinstadler/envswitch <ID>\nThe ID is shown in EnvSwitch under Settings → Branch Manager.'));
  process.exit(1);
}

// Bisher erlaubte IDs behalten (z. B. Arbeits- und Privat-Chrome)
const known = new Set(ids);
for (const f of [...manifests, path.join(__dirname, `${NAME}.json`)]) {
  try {
    for (const o of JSON.parse(fs.readFileSync(f, 'utf8')).allowed_origins ?? []) {
      const id = /^chrome-extension:\/\/([a-p]{32})\/$/.exec(o)?.[1];
      if (id) known.add(id);
    }
  } catch {}
}

// Programm an den festen Ort kopieren
fs.mkdirSync(target, { recursive: true });
const hostJs = path.join(target, 'host.js');
fs.copyFileSync(path.join(__dirname, 'host.js'), hostJs);

// Starter mit festem Pfad zu Node, weil Chrome Programme mit sehr knappem PATH startet
if (isWin) {
  fs.writeFileSync(launcher, `@echo off\r\n"${process.execPath}" "%~dp0host.js" %*\r\n`);
} else {
  fs.writeFileSync(launcher, `#!/bin/sh\n# Chrome startet mit knappem PATH: übliche Orte für git und hg ergänzen\nexport PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin"\nexec "${process.execPath}" "${hostJs}" "$@"\n`);
  fs.chmodSync(launcher, 0o755);
}

// Reste einer älteren Installation direkt im Repo-Ordner aufräumen
for (const old of ['envswitch-host.sh', 'envswitch-host.bat', `${NAME}.json`]) fs.rmSync(path.join(__dirname, old), { force: true });

const manifest = {
  name: NAME,
  description: 'EnvSwitch Branch Manager (git, hg)',
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
  console.error(say('Kein Chrome-Profilordner gefunden. Ist Chrome installiert und schon einmal gestartet worden?', 'No Chrome profile folder found. Is Chrome installed and has it been started once?'));
  process.exit(1);
}
console.log(say(`EnvSwitch-Hilfsprogramm eingerichtet in ${target}`, `EnvSwitch helper installed in ${target}`));
console.log(say(`Erlaubte Extension-IDs: ${[...known].join(', ')}`, `Allowed extension IDs: ${[...known].join(', ')}`));
console.log(written.map(w => `  ✓ ${w}`).join('\n'));
console.log(say('\nFertig. In EnvSwitch unter Einstellungen auf „Verbindung prüfen“ klicken.', '\nDone. In EnvSwitch, click “Check connection” in the settings.'));
