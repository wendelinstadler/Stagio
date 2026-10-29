#!/usr/bin/env node
// Stagio-Hilfsprogramm: führt für die Extension git- und hg-Befehle aus (Chrome Native Messaging).
// Sicherheit: Es gibt nur eine feste Liste von Aktionen, Befehle laufen ohne Shell, Branch-Namen werden geprüft.
'use strict';
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const VERSION = 3;

/* ---------- Native Messaging: 4 Byte Länge (little endian) + JSON ---------- */

let buf = Buffer.alloc(0);
process.stdin.on('data', chunk => {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length >= 4) {
    const len = buf.readUInt32LE(0);
    if (buf.length < 4 + len) break;
    const msg = buf.subarray(4, 4 + len).toString('utf8');
    buf = buf.subarray(4 + len);
    handle(msg);
  }
});
process.stdin.on('end', () => setTimeout(() => process.exit(0), 50));

function send(obj) {
  const data = Buffer.from(JSON.stringify(obj), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(data.length, 0);
  process.stdout.write(Buffer.concat([len, data]));
}

async function handle(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return send({ ok: false, error: 'Ungültige Nachricht' });
  }
  try {
    send({ ok: true, ...(await run(msg)) });
  } catch (err) {
    send({ ok: false, error: String(err.message || err).trim().slice(0, 2000) });
  }
}

/* ---------- Hilfen ---------- */

function exec(bin, args, cwd, timeout = 20000) {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      {
        cwd,
        timeout,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        // Nie auf eine Eingabe warten (z. B. Passwort): lieber sofort mit Fehler abbrechen
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', HGPLAIN: '1', LANG: 'C', LC_ALL: 'C' },
      },
      (err, stdout, stderr) => {
        if (err) {
          if (err.code === 'ENOENT') return reject(new Error(`${bin} wurde nicht gefunden. In den Einstellungen den Pfad zu ${path.basename(bin)} angeben.`));
          if (err.killed) return reject(new Error(`Zeitüberschreitung bei: ${path.basename(bin)} ${args[0]}`));
          return reject(new Error((stderr || stdout || err.message).trim()));
        }
        resolve(stdout.replace(/\r\n/g, '\n'));
      }
    );
  });
}

function repoDir(p) {
  let dir = String(p || '').trim();
  if (!dir) throw new Error('Kein Ordner angegeben');
  if (dir === '~' || dir.startsWith('~/') || dir.startsWith('~\\')) dir = path.join(os.homedir(), dir.slice(1));
  dir = path.resolve(dir);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`Ordner nicht gefunden: ${dir}`);
  return dir;
}

// Sucht nach oben, ob der Ordner in einem git- oder hg-Repo liegt
function detect(dir) {
  let d = dir;
  for (;;) {
    if (fs.existsSync(path.join(d, '.hg'))) return { vcs: 'hg', root: d };
    if (fs.existsSync(path.join(d, '.git'))) return { vcs: 'git', root: d };
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

// Branch-Namen: Buchstaben, Zahlen, / . _ - ; nicht mit - oder . beginnen, keine ..
function checkBranch(name) {
  const n = String(name || '').trim();
  if (!n || n.length > 200 || !/^[\p{L}\p{N}][\p{L}\p{N}/._-]*$/u.test(n) || n.includes('..') || n.endsWith('/') || n.endsWith('.lock')) {
    throw new Error(`Ungültiger Branch-Name: ${n || '(leer)'}`);
  }
  return n;
}

const lines = s => s.split('\n').filter(Boolean);

/* ---------- Git ---------- */

const git = {
  async info(bin, root, o) {
    const st = await exec(bin, ['status', '--porcelain=v1', '-b'], root);
    const [head = '', ...rest] = st.split('\n');
    let branch = '';
    let upstream = null;
    let ahead = 0;
    let behind = 0;
    const m = /^## (?:No commits yet on |Initial commit on )?(.+?)(?:\.\.\.(\S+))?(?: \[(.*)\])?$/.exec(head);
    if (m) {
      branch = m[1];
      upstream = m[2] ?? null;
      ahead = Number(/ahead (\d+)/.exec(m[3] ?? '')?.[1] ?? 0);
      behind = Number(/behind (\d+)/.exec(m[3] ?? '')?.[1] ?? 0);
    }
    if (/^HEAD \(no branch\)$/.test(branch)) branch = `(detached ${(await exec(bin, ['rev-parse', '--short', 'HEAD'], root)).trim()})`;
    const changes = lines(rest.join('\n')).map(l => ({ s: l.slice(0, 2).trim() || '?', f: l.slice(3) }));
    return { branch, upstream, ahead, behind, changes, unpushedLabel: upstream ? null : 'kein Upstream' };
  },
  async branches(bin, root) {
    const out = await exec(bin, ['for-each-ref', '--sort=-committerdate', '--format=%(refname)%09%(refname:short)%09%(committerdate:unix)', 'refs/heads', 'refs/remotes'], root);
    const local = new Set();
    const list = [];
    for (const l of lines(out)) {
      const [ref, short, date] = l.split('\t');
      if (ref.startsWith('refs/heads/')) {
        local.add(short);
        list.push({ name: short, date: Number(date), remote: false });
      }
    }
    for (const l of lines(out)) {
      const [ref, short, date] = l.split('\t');
      if (!ref.startsWith('refs/remotes/') || short.endsWith('/HEAD') || !short.includes('/')) continue;
      const name = short.slice(short.indexOf('/') + 1);
      if (local.has(name) || list.some(b => b.name === name)) continue;
      list.push({ name, date: Number(date), remote: true });
    }
    return { branches: list };
  },
  async log(bin, root, o) {
    const n = Math.min(Math.max(Number(o.count) || 10, 1), 50);
    const out = await exec(bin, ['log', `-n${n}`, '--format=%h%x09%an%x09%at%x09%s'], root).catch(e => (/does not have any commits/.test(e.message) ? '' : Promise.reject(e)));
    return { commits: lines(out).map(l => { const [id, author, date, ...msg] = l.split('\t'); return { id, author, date: Number(date), msg: msg.join('\t') }; }) };
  },
  async switch(bin, root, o) {
    const b = checkBranch(o.branch);
    await exec(bin, ['switch', b], root);
    return {};
  },
  async create(bin, root, o) {
    const b = checkBranch(o.branch);
    await exec(bin, ['switch', '-c', b], root);
    return {};
  },
  async pull(bin, root, o) {
    const mode = { rebase: '--rebase', merge: '--no-rebase' }[o.mode] ?? '--ff-only';
    return { out: await exec(bin, ['pull', mode], root, 120000) };
  },
  async push(bin, root) {
    return { out: await exec(bin, ['push', '-u', 'origin', 'HEAD'], root, 120000) };
  },
  async fetch(bin, root) {
    return { out: await exec(bin, ['fetch', '--prune'], root, 120000) };
  },
};

/* ---------- Mercurial ---------- */

const hg = {
  async info(bin, root) {
    const [branch, bookmark, st, drafts] = await Promise.all([
      exec(bin, ['branch'], root),
      exec(bin, ['log', '-r', '.', '-T', '{activebookmark}'], root).catch(() => ''),
      exec(bin, ['status'], root),
      // Noch nicht gepushte Commits auf diesem Branch (Phase "draft")
      exec(bin, ['log', '-r', 'draft() and branch(.)', '-T', 'x'], root).catch(() => ''),
    ]);
    const changes = lines(st).map(l => ({ s: l[0], f: l.slice(2) }));
    return { branch: branch.trim(), bookmark: bookmark.trim() || null, ahead: drafts.length, behind: null, changes };
  },
  async branches(bin, root) {
    const [br, bm] = await Promise.all([
      exec(bin, ['branches', '-T', '{branch}\t{date(date, "%s")}\t{if(closed, "closed")}\n'], root).catch(() => exec(bin, ['branches'], root).then(o => lines(o).map(l => l.split(/\s+/)[0] + '\t0\t').join('\n'))),
      exec(bin, ['bookmarks', '-T', '{bookmark}\t{date(date, "%s")}\n'], root).catch(() => ''),
    ]);
    const list = lines(br)
      .map(l => l.split('\t'))
      .filter(([, , closed]) => !closed)
      .map(([name, date]) => ({ name, date: Number(date) || 0, kind: 'branch' }));
    for (const l of lines(bm)) {
      const [name, date] = l.split('\t');
      list.push({ name, date: Number(date) || 0, kind: 'bookmark' });
    }
    list.sort((a, b) => b.date - a.date);
    return { branches: list };
  },
  async log(bin, root, o) {
    const n = Math.min(Math.max(Number(o.count) || 10, 1), 50);
    const out = await exec(bin, ['log', '-l', String(n), '-b', '.', '-T', '{node|short}\t{author|person}\t{date(date, "%s")}\t{desc|firstline}\n'], root);
    return { commits: lines(out).map(l => { const [id, author, date, ...msg] = l.split('\t'); return { id, author, date: Number(date), msg: msg.join('\t') }; }) };
  },
  async switch(bin, root, o) {
    const b = checkBranch(o.branch);
    // --check: bricht ab, statt ungespeicherte Änderungen zu vermischen
    await exec(bin, ['update', '--check', b], root);
    return {};
  },
  async create(bin, root, o) {
    const b = checkBranch(o.branch);
    if (o.kind === 'bookmark') {
      await exec(bin, ['bookmark', b], root);
      return {};
    }
    await exec(bin, ['branch', b], root);
    return { note: 'Named Branch gesetzt. In hg entsteht er mit dem nächsten Commit.' };
  },
  async pull(bin, root) {
    return { out: await exec(bin, ['pull', '--update', '--noninteractive'], root, 120000) };
  },
  async push(bin, root) {
    // Nur den aktuellen Stand pushen; neue Named Branches erlauben
    try {
      return { out: await exec(bin, ['push', '-r', '.', '--new-branch', '--noninteractive'], root, 120000) };
    } catch (err) {
      if (/no changes found/i.test(err.message)) return { out: 'Nichts zu pushen.' };
      throw err;
    }
  },
  async fetch(bin, root) {
    try {
      return { out: await exec(bin, ['pull', '--noninteractive'], root, 120000) };
    } catch (err) {
      if (/no changes found/i.test(err.message)) return { out: 'Keine neuen Änderungen.' };
      throw err;
    }
  },
};

/* ---------- Aktionen ---------- */

const ACTIONS = ['info', 'branches', 'log', 'switch', 'create', 'pull', 'push', 'fetch'];

async function run(msg) {
  if (msg.op === 'ping') return { version: VERSION, platform: process.platform, node: process.version };
  const dir = repoDir(msg.path);
  const found = detect(dir);
  if (!found) throw new Error(`Kein git- oder hg-Repo in ${dir}`);
  if (msg.op === 'detect') return found;
  // Team-Datei: nur genau diese eine Datei im Repo-Hauptordner
  if (msg.op === 'readTeam' || msg.op === 'writeTeam') {
    const file = path.join(found.root, '.stagio.json');
    if (msg.op === 'readTeam') {
      // Ältere Repos haben noch .envswitch.json
      const legacy = path.join(found.root, '.envswitch.json');
      if (!fs.existsSync(file) && fs.existsSync(legacy)) {
        if (fs.statSync(legacy).size > 2 * 1024 * 1024) throw new Error('.stagio.json ist grösser als 2 MB');
        return { exists: true, root: found.root, text: fs.readFileSync(legacy, 'utf8') };
      }
      if (!fs.existsSync(file)) return { exists: false, root: found.root };
      const st = fs.statSync(file);
      if (st.size > 2 * 1024 * 1024) throw new Error('.stagio.json ist grösser als 2 MB');
      return { exists: true, root: found.root, text: fs.readFileSync(file, 'utf8') };
    }
    const text = String(msg.text ?? '');
    if (text.length > 2 * 1024 * 1024) throw new Error('Zu gross');
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Kein gültiges JSON');
    }
    if (data?.stagio !== 1 && data?.envswitch !== 1) throw new Error('Keine Stagio-Team-Datei');
    fs.writeFileSync(file, text.endsWith('\n') ? text : text + '\n', 'utf8');
    return { written: file };
  }
  if (!ACTIONS.includes(msg.op)) throw new Error(`Unbekannte Aktion: ${msg.op}`);
  const impl = found.vcs === 'git' ? git : hg;
  const bin = (msg.bins && msg.bins[found.vcs]) || found.vcs;
  if (msg.bins && msg.bins[found.vcs] && !path.isAbsolute(bin)) throw new Error(`Pfad zu ${found.vcs} muss vollständig sein, z. B. /opt/homebrew/bin/${found.vcs}`);
  const res = await impl[msg.op](bin, found.root, msg);
  // Nach Änderungen gleich den neuen Stand mitschicken
  if (['switch', 'create', 'pull', 'push', 'fetch'].includes(msg.op)) res.info = await impl.info(bin, found.root, msg);
  return { vcs: found.vcs, root: found.root, ...res };
}
