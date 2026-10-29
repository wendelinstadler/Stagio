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
      if (old?.vars) e.vars = old.vars;
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

// Welches Format ist das? 'openapi' | 'postman' | 'har' | 'curl' | 'envswitch' | null
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
  if (j.app === 'EnvSwitch' || j.app === 'ApiPeek') return { kind: 'backup', data: j };
  return null;
};
