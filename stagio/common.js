globalThis.T ??= s => s;

// Links an einer Stelle: Website und Unterstützen-Seite (Buy Me a Coffee)
globalThis.LINKS = {
  site: 'https://stagio.dev',
  privacy: 'https://stagio.dev/privacy.html',
  support: 'https://buymeacoffee.com/wendelinstadler',
};
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

  // Baut aus einem gespeicherten Request die echte Anfrage (URL, Header, Body) für eine Umgebung.
  build(r, env, cookies = true) {
    const miss = new Set();
    const sub = s => AP.fill(s, env, miss);

    let path = String(r.path ?? '').trim();
    path = path.replace(/(?<!\{)\{([A-Za-z_][\w.-]*)\}(?!\})/g, (m, n) => {
      const v = sub(r.pathVals?.[n] ?? '');
      return v ? encodeURIComponent(v) : m;
    });
    path = sub(path);

    let url;
    if (/^https?:\/\//i.test(path)) url = new URL(path);
    else {
      if (!env) throw new Error('Keine Umgebung gewählt: links ein Projekt anlegen und oben eine Umgebung wählen, oder eine volle Adresse mit https:// eingeben.');
      url = new URL(env.origin + '/' + path.replace(/^\/+/, ''));
    }
    for (const p of r.params ?? []) if (p.on !== false && p.k.trim()) url.searchParams.append(sub(p.k).trim(), sub(p.v));

    const headers = new Headers();
    for (const p of r.headers ?? []) {
      if (p.on === false || !p.k.trim()) continue;
      try {
        headers.set(sub(p.k).trim(), sub(p.v));
      } catch {
        throw new Error(`Ungültiger Header: ${p.k}`);
      }
    }

    // Header-Presets der Umgebung ergänzen (eigene Header des Requests haben Vorrang)
    for (const x of HDR.of(env)) if (!/^cookie$/i.test(x.k) && !headers.has(x.k)) headers.set(x.k, x.v);

    const init = { method: r.method, headers, credentials: cookies ? 'include' : 'omit', redirect: 'follow', cache: 'no-store' };
    const b = r.body;
    if (!['GET', 'HEAD'].includes(r.method) && b && b.mode !== 'none' && b.text.trim()) {
      if (b.mode === 'form') {
        init.body = new URLSearchParams(Object.entries(AP.parseVars(sub(b.text)))).toString();
        if (!headers.has('content-type')) headers.set('content-type', 'application/x-www-form-urlencoded');
      } else {
        init.body = sub(b.text);
        if (!headers.has('content-type')) headers.set('content-type', b.mode === 'json' ? 'application/json' : 'text/plain;charset=UTF-8');
      }
    }
    return { url, init, miss: [...miss] };
  },

  // Beim Bearbeiten eines Projekts die Variablen der gleichnamigen Umgebungen behalten.
  keepVars(oldEnvs, newEnvs) {
    for (const e of newEnvs) {
      const old = (oldEnvs ?? []).find(o => o.name.toLowerCase() === e.name.toLowerCase()) ?? (oldEnvs ?? []).find(o => o.origin === e.origin);
      // Alles ausser Name und Adresse übernehmen (Variablen, Header-Presets …)
      if (old) for (const [k, v] of Object.entries(old)) if (k !== 'name' && k !== 'origin' && !(k in e)) e[k] = v;
    }
    return newEnvs;
  },
};

// Gemeinsame Anzeige-Helfer für Popup und API-Tester
AP.STATUS = {
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
  415: 'Unsupported Media Type', 422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server Error',
  502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
};
AP.fmtMs = ms => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`);

// ---------- Import: cURL, Postman, HAR ----------
// Alle Parser liefern Requests im eigenen Format. Volle Adressen werden relativ, wenn sie zu einer Umgebung des Projekts passen.

// Header, die der Browser selbst setzt oder die nur stören
AP.SKIP_HEADERS = /^(:|host$|content-length$|connection$|accept-encoding$|user-agent$|origin$|referer$|cookie$|sec-|priority$|pragma$|cache-control$|upgrade-insecure-requests$|dnt$|te$)/i;

// "https://shop.ch/api/x?a=1" -> { path: "/api/x", params: [{k:"a", v:"1"}] } (oder volle Adresse, wenn keine Umgebung passt)
AP.fromUrl = (raw, project) => {
  const s = String(raw ?? '').trim().replace(/^\{\{\s*baseUrl\s*\}\}/, ''); // Postman: {{baseUrl}}/api/… -> /api/…
  let u;
  try {
    u = new URL(s);
  } catch {
    // Relativer Pfad oder mit {{variable}}: Query trotzdem in Parameter aufteilen
    const [p, q = ''] = s.split('?');
    return { path: p || '/', params: [...new URLSearchParams(q)].map(([k, v]) => ({ k, v, on: true })) };
  }
  const params = [...u.searchParams].map(([k, v]) => ({ k, v, on: true }));
  const match = project?.envs.some(e => e.origin === u.origin);
  return { path: (match ? '' : u.origin) + decodeURI(u.pathname), params };
};

// Body-Text und Content-Type -> { mode, text }
AP.bodyFrom = (text, ct = '') => {
  if (text == null || text === '') return { mode: 'json', text: '' };
  if (/form-urlencoded/i.test(ct) || (!ct && /^[\w.%-]+=[^{\[]*(&[\w.%-]+=.*)*$/.test(text) && !/^\s*[{[]/.test(text))) {
    return { mode: 'form', text: [...new URLSearchParams(text)].map(([k, v]) => `${k} = ${v}`).join('\n') };
  }
  try {
    return { mode: 'json', text: JSON.stringify(JSON.parse(text), null, 2) };
  } catch {
    return { mode: /json/i.test(ct) ? 'json' : 'text', text };
  }
};

// Shell-Wörter trennen (bash: '…', "…", \ ; Windows cmd: ^)
AP.shellWords = s => {
  if (/\^"/.test(s)) s = s.replace(/\^\r?\n/g, ' ').replace(/\^(.)/g, '$1'); // "Copy as cURL (cmd)"
  const out = [];
  let cur = null;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && (s[i + 1] === '\n' || (s[i + 1] === '\r' && s[i + 2] === '\n'))) {
      i += s[i + 1] === '\r' ? 3 : 2;
      continue;
    }
    if (/\s/.test(c)) {
      if (cur != null) out.push(cur), (cur = null);
      i++;
      continue;
    }
    cur ??= '';
    if (c === "'") {
      const j = s.indexOf("'", i + 1);
      cur += s.slice(i + 1, j < 0 ? s.length : j);
      i = j < 0 ? s.length : j + 1;
    } else if (c === '$' && s[i + 1] === "'") {
      // $'…' mit \n, \t, \' usw.
      let j = i + 2;
      while (j < s.length && s[j] !== "'") {
        if (s[j] === '\\' && j + 1 < s.length) {
          const n = s[j + 1];
          cur += { n: '\n', t: '\t', r: '\r', "'": "'", '"': '"', '\\': '\\' }[n] ?? n;
          j += 2;
        } else cur += s[j++];
      }
      i = j + 1;
    } else if (c === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') {
        if (s[j] === '\\' && /["\\$`]/.test(s[j + 1] ?? '')) j++;
        cur += s[j++];
      }
      i = j + 1;
    } else if (c === '\\') {
      cur += s[i + 1] ?? '';
      i += 2;
    } else {
      cur += c;
      i++;
    }
  }
  if (cur != null) out.push(cur);
  return out;
};

// Ein oder mehrere cURL-Befehle -> Requests
AP.parseCurls = (text, project) => {
  const parts = String(text).split(/(?:^|\n|;|&&)\s*(?=curl(?:\.exe)?\s)/).map(x => x.trim()).filter(x => /^curl(\.exe)?\s/.test(x));
  if (!parts.length) throw new Error('Kein cURL-Befehl gefunden. Er beginnt mit „curl “.');
  return parts.map(part => {
    const w = AP.shellWords(part).slice(1);
    let method = null;
    let url = null;
    let get = false;
    const headers = [];
    const data = [];
    for (let i = 0; i < w.length; i++) {
      let a = w[i];
      let val = null;
      const eq = /^(--[\w-]+)=(.*)$/s.exec(a);
      if (eq) [a, val] = [eq[1], eq[2]];
      const next = () => val ?? w[++i];
      if (a === '-X' || a === '--request') method = next().toUpperCase();
      else if (/^-X./.test(a)) method = a.slice(2).toUpperCase();
      else if (a === '-H' || a === '--header') {
        const hv = next() ?? '';
        const k = hv.indexOf(':');
        if (k > 0) headers.push({ k: hv.slice(0, k).trim(), v: hv.slice(k + 1).trim() });
      } else if (['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode', '--json'].includes(a)) {
        data.push(next() ?? '');
        if (a === '--json') headers.push({ k: 'Content-Type', v: 'application/json' });
      } else if (a === '-u' || a === '--user') headers.push({ k: 'Authorization', v: 'Basic ' + btoa(next() ?? '') });
      else if (a === '-G' || a === '--get') get = true;
      else if (a === '--url') url = next();
      else if (['-b', '--cookie', '-A', '--user-agent', '-e', '--referer', '-o', '--output', '-m', '--max-time', '--connect-timeout', '-x', '--proxy', '-w', '--write-out'].includes(a)) next();
      else if (!a.startsWith('-') && url == null) url = a;
    }
    if (!url) throw new Error('In einem cURL-Befehl fehlt die Adresse.');
    let body = data.join('&');
    if (get && body) {
      url += (url.includes('?') ? '&' : '?') + body;
      body = '';
    }
    method ??= body ? 'POST' : 'GET';
    const ct = headers.find(x => /^content-type$/i.test(x.k))?.v ?? '';
    const { path, params } = AP.fromUrl(url, project);
    return AP.newReq({
      method,
      path,
      params,
      headers: headers.filter(x => !AP.SKIP_HEADERS.test(x.k)).map(x => ({ ...x, on: true })),
      body: AP.bodyFrom(body, ct),
    });
  });
};

// Postman Collection v2 -> [{ name, reqs }] (ein Ordner = eine Sammlung)
AP.parsePostman = (col, project) => {
  const groups = new Map();
  const add = (name, r) => {
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(r);
  };
  const conv = (it, auth) => {
    const q = typeof it.request === 'string' ? { url: it.request, method: 'GET' } : it.request ?? {};
    const rawUrl = typeof q.url === 'string' ? q.url : q.url?.raw ?? '';
    const { path, params } = AP.fromUrl(rawUrl.replace(/:([A-Za-z_]\w*)/g, (m, n, off, s) => (s[off - 1] === '/' ? `{${n}}` : m)), project);
    const pathVals = {};
    for (const v of q.url?.variable ?? []) if (v.key) pathVals[v.key] = String(v.value ?? '');
    const headers = (q.header ?? []).filter(x => x.key).map(x => ({ k: x.key, v: String(x.value ?? ''), on: !x.disabled }));
    const a = q.auth ?? auth;
    if (a?.type === 'bearer') {
      const t = (a.bearer ?? []).find(x => x.key === 'token')?.value ?? '';
      if (!headers.some(x => /^authorization$/i.test(x.k))) headers.push({ k: 'Authorization', v: `Bearer ${t}`, on: true });
    } else if (a?.type === 'basic') {
      const g = k => (a.basic ?? []).find(x => x.key === k)?.value ?? '';
      if (!headers.some(x => /^authorization$/i.test(x.k))) headers.push({ k: 'Authorization', v: 'Basic ' + btoa(`${g('username')}:${g('password')}`), on: true });
    }
    let body = { mode: 'json', text: '' };
    const b = q.body;
    if (b?.mode === 'raw') body = AP.bodyFrom(b.raw ?? '', b.options?.raw?.language === 'json' ? 'application/json' : '');
    else if (b?.mode === 'urlencoded' || b?.mode === 'formdata') body = { mode: 'form', text: (b[b.mode] ?? []).filter(x => !x.disabled && x.type !== 'file').map(x => `${x.key} = ${x.value ?? ''}`).join('\n') };
    else if (b?.mode === 'graphql') body = { mode: 'json', text: JSON.stringify({ query: b.graphql?.query ?? '', variables: b.graphql?.variables ? JSON.parse(b.graphql.variables || '{}') : {} }, null, 2) };
    return AP.newReq({ method: String(q.method || 'GET').toUpperCase(), path, params, pathVals, headers, body, summary: it.name ?? '' });
  };
  const walk = (items, folder, auth) => {
    for (const it of items ?? []) {
      if (Array.isArray(it.item)) walk(it.item, it.name || folder, it.auth ?? auth);
      else add(folder, conv(it, auth));
    }
  };
  const name = col.info?.name || 'Postman';
  walk(col.item, name, col.auth);
  return { name, groups: [...groups].map(([name, reqs]) => ({ name, reqs })) };
};

// HAR (DevTools → Netzwerk → „Alle als HAR speichern“) -> Requests, nur API-Aufrufe, ohne Duplikate
AP.parseHar = (har, project) => {
  const seen = new Set();
  const reqs = [];
  for (const e of har.log?.entries ?? []) {
    const q = e.request;
    if (!q?.url || !/^https?:/i.test(q.url)) continue;
    const type = e._resourceType ?? '';
    const resCt = e.response?.content?.mimeType ?? '';
    const api = /^(xhr|fetch)$/i.test(type) || (!type && (/json|xml/i.test(resCt) || q.method !== 'GET'));
    if (!api) continue;
    const { path, params } = AP.fromUrl(q.url, project);
    const key = `${q.method} ${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const headers = (q.headers ?? []).filter(x => !AP.SKIP_HEADERS.test(x.name)).map(x => ({ k: x.name, v: x.value, on: true }));
    const ct = q.postData?.mimeType ?? '';
    reqs.push(AP.newReq({ method: q.method, path, params, headers, body: AP.bodyFrom(q.postData?.text ?? '', ct) }));
  }
  return reqs;
};

// Welches Format ist das? 'openapi' | 'postman' | 'har' | 'curl' | 'backup' | null
AP.detect = text => {
  const t = String(text ?? '').trim();
  if (/^curl(\.exe)?\s/m.test(t) && !/^\s*[{[]/.test(t)) return { kind: 'curl', data: t };
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    return null;
  }
  if ((j.openapi || j.swagger) && j.paths) return { kind: 'openapi', data: j };
  if (j.log?.entries) return { kind: 'har', data: j };
  if (Array.isArray(j.item) && (j.info?._postman_id || /postman/i.test(j.info?.schema ?? '') || j.info)) return { kind: 'postman', data: j };
  if (j.collection?.item) return { kind: 'postman', data: j.collection };
  if (j.app === 'Stagio' || j.app === 'EnvSwitch' || j.app === 'ApiPeek') return { kind: 'backup', data: j };
  return null;
};

// ---------- Branch Manager (git und hg über das Hilfsprogramm) ----------
globalThis.VCS = {
  HOST: 'com.stagio.helper',

  DEFAULTS: {
    features: { branch: true, switch: true, sync: true, log: true },
    showOnPage: true,
    template: 'feature/{ticket}-{titel}',
    hgNew: 'branch',
    gitPull: 'ff-only',
    logCount: 10,
    bins: { git: '', hg: '' },
    repos: {}, // { [projectId]: [{ id, name, path }] }
  },

  async get() {
    const { vcs } = await chrome.storage.local.get('vcs');
    const d = structuredClone(this.DEFAULTS);
    return { ...d, ...vcs, features: { ...d.features, ...vcs?.features }, bins: { ...d.bins, ...vcs?.bins }, repos: vcs?.repos ?? {} };
  },

  save(v) {
    return chrome.storage.local.set({ vcs: v });
  },

  // Eine Aktion im Hilfsprogramm ausführen. Wirft verständliche Fehler.
  call(msg, settings) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime.sendNativeMessage) return reject(new Error('Branch Manager braucht die Berechtigung „nativeMessaging“. Extension neu laden.'));
      const bins = Object.fromEntries(Object.entries(settings?.bins ?? {}).filter(([, v]) => v));
      chrome.runtime.sendNativeMessage(this.HOST, { ...msg, bins }, res => {
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(this.explain(err.message)));
        if (!res) return reject(new Error('Keine Antwort vom Hilfsprogramm.'));
        if (!res.ok) return reject(new Error(res.error));
        resolve(res);
      });
    });
  },

  explain(m) {
    if (/not found/i.test(m)) return 'Hilfsprogramm nicht installiert. Siehe Einstellungen → Hilfsprogramm.';
    if (/forbidden/i.test(m)) return 'Das Hilfsprogramm kennt diese Extension nicht. install.js mit der ID aus den Einstellungen nochmals ausführen.';
    if (/exited|communicating|failed to start/i.test(m)) return 'Hilfsprogramm startet nicht (Node verschoben?). install.js nochmals ausführen.';
    return m;
  },

  // "feature/{ticket}-{titel}" + "ABC-123" + "Login reparieren" -> "feature/ABC-123-login-reparieren"
  branchName(template, ticket, title) {
    const slug = String(title ?? '')
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
    const t = String(ticket ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]+/g, '');
    return String(template || '{ticket}-{titel}')
      .replace(/\{ticket\}/g, t)
      .replace(/\{titel\}/g, slug)
      .replace(/-{2,}/g, '-')
      .replace(/\/-|-\//g, '/')
      .replace(/^[-/]+|[-/]+$/g, '');
  },

  ago(ts) {
    if (!ts) return '';
    const s = Math.max(0, Date.now() / 1000 - ts);
    if (s < 60) return T('gerade eben');
    if (s < 3600) return T(`vor ${Math.floor(s / 60)} Min.`);
    if (s < 86400) return T(`vor ${Math.floor(s / 3600)} Std.`);
    if (s < 86400 * 30) return T(`vor ${Math.floor(s / 86400)} T.`);
    return new Date(ts * 1000).toLocaleDateString(globalThis.I18N?.locale ?? 'de-CH');
  },
};

// ---------- Allgemeine Einstellungen ----------
globalThis.PREFS = {
  DEFAULTS: { health: true, errors: true, lang: 'auto' },
  async get() {
    const { prefs } = await chrome.storage.local.get('prefs');
    return { ...this.DEFAULTS, ...prefs };
  },
  async set(part) {
    const cur = await this.get();
    return chrome.storage.local.set({ prefs: { ...cur, ...part } });
  },
};

// ---------- Header-Presets pro Umgebung ----------
// Zeilen "Name: Wert" (oder "Name = Wert"). Werte dürfen {{variablen}} der Umgebung enthalten.
globalThis.HDR = {
  parse(text) {
    const out = [];
    for (const raw of String(text ?? '').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+)\s*[:=]\s*(.*)$/.exec(line);
      if (!m) throw new Error(`Zeile nicht verstanden: «${line}». Beispiel: X-Debug: true`);
      out.push({ k: m[1], v: m[2] });
    }
    return out;
  },
  // Gültige Header einer Umgebung, mit eingesetzten Variablen. Fehlerhafte Zeilen werden übersprungen.
  of(env) {
    if (!env?.headers || env.headersOn === false) return [];
    try {
      return this.parse(env.headers).map(x => ({ k: x.k, v: AP.fill(x.v, env) }));
    } catch {
      return [];
    }
  },
};

// ---------- Server-Status ----------
// Prüft, ob eine Umgebung antwortet. Ohne Zugriffsrecht reicht eine "no-cors"-Anfrage: kommt etwas zurück, läuft der Server.
globalThis.HEALTH = {
  async check(env, project, timeout = 6000) {
    const url = env.origin + '/' + String(project?.health || '').replace(/^\/+/, '');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const t0 = performance.now();
    try {
      const granted = await chrome.permissions.contains({ origins: [LS.pattern(env.origin)] }).catch(() => false);
      const res = await fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'follow', signal: ctrl.signal, ...(granted ? {} : { mode: 'no-cors' }) });
      const ms = Math.round(performance.now() - t0);
      res.body?.cancel().catch(() => {});
      if (res.type === 'opaque') return { state: 'up', ms, status: null, url };
      return { state: res.status >= 500 ? 'error' : res.status >= 400 ? 'warn' : 'up', ms, status: res.status, url };
    } catch (err) {
      return { state: 'down', ms: null, status: null, url, error: err.name === 'AbortError' ? 'Zeitüberschreitung' : 'nicht erreichbar' };
    } finally {
      clearTimeout(timer);
    }
  },
  title(r) {
    if (!r) return 'Prüfe …';
    if (r.state === 'down') return `Antwortet nicht (${r.error}) · ${r.url}`;
    return `${r.status ? `Status ${r.status}` : 'Erreichbar'} · ${r.ms} ms · ${r.url}`;
  },
};

// ---------- Team-Konfiguration (.stagio.json) ----------
// Projekt, Umgebungen, Seiten, Header-Presets und API-Sammlungen als Datei fürs Projekt-Repo.
// Nie drin: Variablen (Tokens) und persönliche Einstellungen. Geheime Header-Werte werden durch {{variablen}} ersetzt.
globalThis.TEAM = {
  FILE: '.stagio.json',
  SECRET: /^(authorization|proxy-authorization|cookie)$|api[_-]?key|token|secret|passw|session|^x-auth/i,

  // Kurzer Fingerabdruck, um Änderungen zu erkennen
  hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
    return h.toString(36);
  },

  // Geheimen Wert durch Variable ersetzen. Gibt [neuerWert, ersetzt?] zurück.
  scrub(name, value, replaced) {
    const v = String(value ?? '');
    if (!this.SECRET.test(name) || !v || /\{\{.+\}\}/.test(v)) return v;
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const out = /^bearer\s+/i.test(v) ? 'Bearer {{token}}' : /^basic\s+/i.test(v) ? 'Basic {{basic_auth}}' : `{{${slug}}}`;
    replaced.add(`${name} → ${out}`);
    return out;
  },

  export(project, cols) {
    const replaced = new Set();
    const envs = project.envs.map(e => {
      const out = { name: e.name, origin: e.origin };
      if (e.headers?.trim()) {
        out.headers = e.headers
          .split('\n')
          .map(line => {
            const m = /^([^:=\s]+)\s*([:=])\s*(.*)$/.exec(line.trim());
            return m ? `${m[1]}${m[2] === ':' ? ': ' : ' = '}${this.scrub(m[1], m[3], replaced)}` : line;
          })
          .join('\n');
      }
      return out;
    });
    const collections = cols
      .filter(c => c.projectId === project.id)
      .map(c => ({
        name: c.name,
        reqs: c.reqs.map(r => ({
          id: r.id,
          method: r.method,
          path: r.path,
          summary: r.summary || undefined,
          params: (r.params ?? []).filter(p => p.k?.trim()).map(p => ({ k: p.k, v: this.scrub(p.k, p.v, replaced), on: p.on !== false })),
          headers: (r.headers ?? []).filter(p => p.k?.trim()).map(p => ({ k: p.k, v: this.scrub(p.k, p.v, replaced), on: p.on !== false })),
          pathVals: Object.keys(r.pathVals ?? {}).length ? r.pathVals : undefined,
          body: r.body?.text?.trim() ? r.body : undefined,
        })),
      }));
    const data = {
      stagio: 1,
      key: project.teamKey,
      name: project.name,
      health: project.health || undefined,
      envs,
      pages: project.pages?.length ? project.pages : undefined,
      collections,
    };
    return { text: JSON.stringify(data, null, 2) + '\n', replaced: [...replaced] };
  },

  parse(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch {
      throw new Error('Die Datei ist kein gültiges JSON.');
    }
    // .envswitch.json aus älteren Versionen wird weiter akzeptiert
    if (d?.stagio !== 1 && d?.envswitch !== 1) throw new Error('Das ist keine Stagio-Team-Datei (.stagio.json).');
    if (!d.name || !Array.isArray(d.envs) || !d.envs.length) throw new Error('In der Team-Datei fehlen Name oder Umgebungen.');
    for (const e of d.envs) {
      if (!e?.name || !e.origin) throw new Error('Jede Umgebung braucht name und origin.');
      e.origin = LS.origin(e.origin);
      if (e.headers) HDR.parse(e.headers);
    }
    return d;
  },

  // Übernimmt eine Team-Datei: aktualisiert das passende Projekt (gleicher Schlüssel oder Name) oder legt eins an.
  apply(text, projects, cols) {
    const d = this.parse(text);
    let p = (d.key && projects.find(x => x.teamKey === d.key)) || projects.find(x => !x.teamKey && x.name.toLowerCase() === d.name.toLowerCase());
    const created = !p;
    if (!p) {
      p = { id: Date.now().toString(36), name: d.name, envs: [], pages: [] };
      projects.push(p);
    }
    const envs = d.envs.map(e => ({ name: e.name, origin: e.origin, ...(e.headers ? { headers: e.headers } : {}) }));
    Object.assign(p, {
      name: d.name,
      teamKey: d.key || p.teamKey || AP.id() + AP.id(),
      envs: AP.keepVars(p.envs, envs),
      pages: d.pages ?? [],
      health: d.health ?? '',
      teamHash: this.hash(text),
      teamAt: Date.now(),
    });
    // Team-Sammlungen ersetzen, eigene Sammlungen bleiben. Sterne (im Popup) bleiben erhalten.
    const pinned = new Set(cols.filter(c => c.projectId === p.id).flatMap(c => c.reqs.filter(r => r.pin).map(r => r.id)));
    const keep = cols.filter(c => !(c.projectId === p.id && c.src === 'team'));
    const fresh = (d.collections ?? []).map(c => ({
      id: AP.id(),
      name: c.name,
      projectId: p.id,
      src: 'team',
      folded: false,
      reqs: (c.reqs ?? []).map(r => {
        const req = AP.newReq({ ...r, id: r.id || AP.id(), params: r.params ?? [], headers: r.headers ?? [], pathVals: r.pathVals ?? {}, body: r.body ?? { mode: 'json', text: '' }, summary: r.summary ?? '' });
        if (pinned.has(req.id)) req.pin = true;
        return req;
      }),
    }));
    // Lokale Kopien derselben Requests (gleiche ID) in eigenen Sammlungen nicht doppelt lassen
    const ids = new Set(fresh.flatMap(c => c.reqs.map(r => r.id)));
    const emptied = new Set();
    for (const c of keep) {
      if (c.projectId !== p.id) continue;
      const before = c.reqs.length;
      c.reqs = c.reqs.filter(r => !ids.has(r.id));
      if (before && !c.reqs.length) emptied.add(c);
    }
    const nextCols = [...keep.filter(c => !emptied.has(c)), ...fresh];
    return { project: p, projects, cols: nextCols, created, envs: envs.length, reqs: fresh.reduce((n, c) => n + c.reqs.length, 0) };
  },
};
