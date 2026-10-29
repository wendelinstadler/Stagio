// Gemeinsame Logik für Popup, Service Worker und Seiten-Markierung.
// Alle Daten bleiben in chrome.storage.local, also nur auf diesem Computer.
globalThis.LS = {
  async projects() {
    const local = await chrome.storage.local.get('projects');
    if (local.projects) return local.projects;
    // Einmaliger Umzug aus Version 1.1, die noch im synchronisierten Speicher ablegte.
    const old = await chrome.storage.sync.get(['projects', 'marker']);
    if (!old.projects) return [];
    await chrome.storage.local.set({ projects: old.projects, marker: old.marker !== false });
    await chrome.storage.sync.remove(['projects', 'marker']);
    return old.projects;
  },

  save(projects) {
    return chrome.storage.local.set({ projects });
  },

  // "localhost:3000", "shop.ch" oder "https://test.example.ch/irgendwas" -> Origin.
  // Ohne http/https davor: lokale Adressen bekommen http, alle anderen Domains (.ch, .com, ...) https.
  origin(input) {
    const s = String(input).trim();
    const hasScheme = /^https?:\/\//i.test(s);
    if (!hasScheme && /^[a-z][a-z0-9+.-]*:\/\//i.test(s)) throw new Error('nur http/https');
    const raw = s.replace(/^https?:\/\//i, '').split(/[/:?#]/)[0];
    const ip = /^(\d{1,3}\.){3}\d{1,3}$/.test(raw);
    const named = /^[\p{L}\p{N}.-]+$/u.test(raw) && /\p{L}/u.test(raw);
    if (!(ip || named || s.replace(/^https?:\/\//i, '').startsWith('['))) throw new Error('keine Adresse');
    if (hasScheme) return new URL(s).origin;
    const local = this.isLocal(raw);
    return new URL(`${local ? 'http' : 'https'}://${s}`).origin;
  },

  // Lokale Adresse? (localhost, IP-Adresse, Name ohne Punkt oder mit Endung wie .local)
  isLocal(host) {
    const h = String(host || '');
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.startsWith('[') || !h.includes('.') || /\.(local|localhost|test|internal|lan|home)$/i.test(h);
  },

  // "Name = Wert" oder "Name Wert". Der Name darf beliebig sein, auch mit Leerzeichen ("Prod 2").
  split(line) {
    const m =
      /^(.+?)\s*=\s*((?:https?:\/\/|\/)\S*)$/i.exec(line) || // Wert beginnt klar erkennbar, Name darf auch "=" enthalten
      /^(.+?)\s*=\s*(\S+)$/.exec(line) ||
      /^(.+\S)\s+(\S+)$/.exec(line);
    return m ? { name: m[1].trim(), value: m[2] } : { name: null, value: line };
  },

  // Zeilen wie "Lokal = http://localhost:3000" -> [{ name, origin }]
  parse(text) {
    const envs = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const { name, value } = this.split(line);
      let origin;
      try {
        origin = this.origin(value);
      } catch {
        throw new Error(`Zeile nicht verstanden: «${line}». Beispiel: Prod 2 = https://shop.ch`);
      }
      envs.push({ name: name || new URL(origin).host, origin });
    }
    if (!envs.length) throw new Error('Mindestens eine Umgebung angeben, eine pro Zeile.');
    return envs;
  },

  // Zeilen wie "Backoffice = /backoffice" -> [{ name, path }]. Der Pfad gilt in jeder Umgebung.
  parsePages(text, envs = []) {
    const pages = [];
    const same = (x, y) => x.trim().toLowerCase() === y.trim().toLowerCase();
    for (const raw of String(text || '').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const { name, value: path } = this.split(line);
      if (/^https?:\/\//i.test(path)) {
        try {
          new URL(path);
        } catch {
          throw new Error(`Ungültige Adresse: ${line}`);
        }
      } else if (!path.startsWith('/')) {
        throw new Error(`Seiten beginnen mit / oder https://: «${line}». Beispiel: Backoffice = /backoffice`);
      }
      // "Backoffice @ Prod = /anders": gilt nur in der Umgebung "Prod".
      const at = name ? /^(.+?)\s*@\s*(.+)$/.exec(name) : null;
      if (at) {
        const env = envs.find(e => same(e.name, at[2]));
        if (!env) throw new Error(`Die Umgebung «${at[2].trim()}» gibt es in diesem Projekt nicht: «${line}»`);
        let page = pages.find(p => same(p.name, at[1]));
        if (!page) pages.push((page = { name: at[1].trim(), path: null }));
        page.per = [...(page.per || []).filter(x => x.env !== env.name), { env: env.name, path }];
      } else {
        const label = name || path;
        const page = pages.find(p => same(p.name, label));
        if (page) page.path = path;
        else pages.push({ name: label, path });
      }
    }
    return pages;
  },

  // Umkehrung von parsePages, für das Bearbeiten-Formular.
  pagesText(pages) {
    const lines = [];
    for (const p of pages || []) {
      if (p.path) lines.push(`${p.name} = ${p.path}`);
      for (const x of p.per || []) lines.push(`${p.name} @ ${x.env} = ${x.path}`);
    }
    return lines.join('\n');
  },

  // Adresse einer Seite in einer Umgebung. null, wenn es die Seite dort nicht gibt.
  pageUrl(env, page) {
    const own = (page.per || []).find(x => x.env.toLowerCase() === env.name.toLowerCase());
    const path = own ? own.path : page.path;
    if (!path) return null;
    return /^https?:\/\//i.test(path) ? path : env.origin + path;
  },

  // Berechtigungs-Muster für eine Umgebung, z. B. "https://test.example.ch/*" (Ports spielen keine Rolle).
  pattern(origin) {
    const u = new URL(origin);
    return `${u.protocol}//${u.hostname}/*`;
  },

  // Live-Umgebungen werden besonders geschützt: Wechsel und Öffnen nur nach Rückfrage.
  isProd(name) {
    return /prod|live/i.test(String(name || ''));
  },

  // Ziel eines Tastenkürzels. Live wird übersprungen, weil dort keine Rückfrage möglich ist. -1 = nichts tun.
  shortcutTarget(envs, current, command) {
    const direct = /^env-(\d)$/.exec(command);
    if (direct) {
      const i = Number(direct[1]) - 1;
      return envs[i] && i !== current && !this.isProd(envs[i].name) ? i : -1;
    }
    if (command !== 'next-env') return -1;
    for (let step = 1; step < envs.length; step++) {
      const i = (current + step) % envs.length;
      if (!this.isProd(envs[i].name)) return i;
    }
    return -1;
  },

  match(projects, url) {
    let origin;
    try {
      origin = new URL(url).origin;
    } catch {
      return null;
    }
    for (const project of projects) {
      const index = project.envs.findIndex(e => e.origin === origin);
      if (index >= 0) return { project, index, env: project.envs[index] };
    }
    return null;
  },

  // Gleicher Pfad, gleiche Parameter, andere Umgebung.
  target(url, origin) {
    const u = new URL(url);
    return origin + u.pathname + u.search + u.hash;
  },

  color(name) {
    if (this.isProd(name)) return '#c5221f';
    if (/lo[ck]al/i.test(name)) return '#188038';
    if (/test|stag|int|qa|dev|preview/i.test(name)) return '#b06000';
    return '#1a73e8';
  },

  // Passende Farbe für Chrome-Tab-Gruppen.
  groupColor(name) {
    return { '#c5221f': 'red', '#188038': 'green', '#b06000': 'orange' }[this.color(name)] || 'blue';
  },
};

// ---------- API-Tester ----------
// Umgebungen sind die gleichen wie oben ({ name, origin }), dazu optional vars ("Name = Wert" pro Zeile).
globalThis.AP = {
  id() {
    return crypto.randomUUID().slice(0, 8);
  },

  isProd: name => LS.isProd(name),
  color: name => LS.color(name),

  newReq(over = {}) {
    return { id: this.id(), method: 'GET', path: '', summary: '', params: [], headers: [], pathVals: {}, body: { mode: 'json', text: '' }, ...over };
  },

  async cols() {
    return (await chrome.storage.local.get('apiCols')).apiCols ?? [];
  },

  parseVars(text) {
    const out = {};
    for (const line of String(text ?? '').split('\n')) {
      const i = line.indexOf('=');
      if (i < 1) continue;
      const k = line.slice(0, i).trim();
      if (k) out[k] = line.slice(i + 1).trim();
    }
    return out;
  },

  // Ersetzt {{name}} durch Variablen der Umgebung. Unbekannte Namen landen in miss.
  fill(s, env, miss) {
    const vars = env ? { ...this.parseVars(env.vars), baseUrl: env.origin } : {};
    return String(s ?? '').replace(/\{\{\s*([$\w.-]+)\s*\}\}/g, (m, n) => {
      if (n === '$uuid') return crypto.randomUUID();
      if (n === '$timestamp') return String(Math.floor(Date.now() / 1000));
      if (n === '$isoDate') return new Date().toISOString();
      if (n in vars) return vars[n];
      miss?.add(n);
      return m;
    });
  },

  // Pfad-Parameter im Swagger-Stil: /users/{id} (einfache Klammern, nicht {{...}})
  pathNames(path) {
    return [...new Set([...String(path ?? '').matchAll(/(?<!\{)\{([A-Za-z_][\w.-]*)\}(?!\})/g)].map(m => m[1]))];
  },

  // Beim Bearbeiten eines Projekts die Variablen der gleichnamigen Umgebungen behalten.
  keepVars(oldEnvs, newEnvs) {
    for (const e of newEnvs) {
      const old = (oldEnvs ?? []).find(o => o.name.toLowerCase() === e.name.toLowerCase()) ?? (oldEnvs ?? []).find(o => o.origin === e.origin);
      if (old?.vars) e.vars = old.vars;
    }
    return newEnvs;
  },
};
