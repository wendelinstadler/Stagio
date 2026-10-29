importScripts('common.js');

// Zeigt auf dem Icon an, in welcher Umgebung der Tab gerade ist.
// Die Adresse eines Tabs ist nur sichtbar, wenn sie zu einer erlaubten Projekt-Adresse gehört.
async function paint(tab) {
  if (!tab?.id) return;
  try {
    const m = tab.url ? LS.match(await LS.projects(), tab.url) : null;
    if (m) refreshBranch(m);
    // Vorrang: Aufnahme läuft > Fehler auf der Seite > Umgebungsname
    await Promise.all([loadLogs(), loadRec()]);
    const errors = (LOGS.get(tab.id) ?? []).reduce((n, x) => n + (x.n ?? 1), 0);
    const rec = REC.get(tab.id)?.on;
    const text = rec ? 'REC' : errors ? (errors > 99 ? '99+' : String(errors)) : m ? m.env.name.slice(0, 4).toUpperCase() : '';
    await chrome.action.setBadgeText({ tabId: tab.id, text });
    if (text) {
      await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: rec || errors ? '#c5221f' : LS.color(m.env.name) });
      await chrome.action.setBadgeTextColor({ tabId: tab.id, color: '#ffffff' });
    }
    await chrome.action.setTitle({ tabId: tab.id, title: ['EnvSwitch', m && `${m.project.name} · ${m.env.name}`, errors && `${errors} ${errors === 1 ? 'Fehler' : 'Fehler'} auf dieser Seite`, rec && 'Aufnahme läuft'].filter(Boolean).join('\n') });
  } catch {
    /* Tab wurde inzwischen geschlossen */
  }
}

const paintAll = async () => (await chrome.tabs.query({})).forEach(paint);

// ---------- Markierung nur auf den Adressen der eigenen Projekte ----------

const MARKER = { id: 'marker', js: ['common.js', 'marker.js'], runAt: 'document_idle', persistAcrossSessions: true };
// Fehler der Seite sammeln: ein Skript in der Seite selbst (MAIN) und eine Brücke zur Extension
const ERR_MAIN = { id: 'errors-main', js: ['errors-main.js'], runAt: 'document_start', world: 'MAIN', allFrames: false, persistAcrossSessions: true };
const ERR_BRIDGE = { id: 'errors-bridge', js: ['errors-bridge.js'], runAt: 'document_start', persistAcrossSessions: true };

async function syncNow() {
  const projects = await LS.projects();
  const wanted = [...new Set(projects.flatMap(p => p.envs.map(e => LS.pattern(e.origin))))];

  // Berechtigungen für Adressen abgeben, die in keinem Projekt mehr vorkommen.
  // Adressen, die der API-Tester braucht, behalten (auch wenn sie in keinem Projekt stehen).
  const { apiOrigins = [] } = await chrome.storage.local.get('apiOrigins');
  const held = (await chrome.permissions.getAll()).origins || [];
  const unused = held.filter(o => !wanted.includes(o) && !apiOrigins.includes(o));
  if (unused.length) await chrome.permissions.remove({ origins: unused }).catch(() => {});

  const granted = [];
  for (const o of wanted) if (await chrome.permissions.contains({ origins: [o] })) granted.push(o);

  await syncHeaders(projects, granted);
  await syncErrorScripts(granted);

  const [have] = await chrome.scripting.getRegisteredContentScripts({ ids: [MARKER.id] });
  if (!granted.length) {
    if (have) await chrome.scripting.unregisterContentScripts({ ids: [MARKER.id] });
    return;
  }
  if (have) await chrome.scripting.updateContentScripts([{ id: MARKER.id, matches: granted }]);
  else await chrome.scripting.registerContentScripts([{ ...MARKER, matches: granted }]);

  // Bereits offene Tabs neu erlaubter Adressen sofort markieren.
  const fresh = granted.filter(o => !(have?.matches || []).includes(o));
  if (fresh.length) {
    for (const t of await chrome.tabs.query({ url: fresh })) {
      chrome.scripting.executeScript({ target: { tabId: t.id }, files: MARKER.js }).catch(() => {});
    }
  }
}

let chain = Promise.resolve();
const sync = () => (chain = chain.then(syncNow, syncNow).then(paintAll, paintAll));

chrome.tabs.onUpdated.addListener((_id, info, tab) => {
  if (info.url || info.status) paint(tab);
});
// Nur bei Projekten und Einstellungen neu einrichten, nicht bei jeder Änderung im API-Tester.
chrome.storage.onChanged.addListener(ch => {
  if (ch.projects || ch.marker || ch.apiOrigins || ch.prefs) sync();
});
chrome.permissions.onAdded.addListener(sync);
chrome.permissions.onRemoved.addListener(sync);
chrome.runtime.onInstalled.addListener(sync);
chrome.runtime.onStartup.addListener(sync);

// ---------- Nachrichten aus dem Popup ----------

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  if (m?.type === 'sync') {
    sync().then(() => reply({ ok: true }));
    return true;
  }
  if (m?.type === 'open-api') {
    openApi(m.url, m.projectId, undefined, m.reqId, m.import).then(() => reply({ ok: true }));
    return true;
  }
  if (m?.type !== 'open') return false;
  // Öffnet mehrere Seiten auf einmal. Jede Gruppe (z. B. eine Umgebung) wird zu einer benannten Tab-Gruppe.
  (async () => {
    const groups = m.groups || [{ urls: m.urls, title: m.title, color: m.color }];
    let count = 0;
    for (const g of groups) {
      const urls = (g.urls || []).filter(u => /^https?:\/\//i.test(u)).slice(0, Math.max(0, 40 - count));
      const ids = [];
      for (const url of urls) {
        const t = await chrome.tabs.create({
          url,
          active: count === 0,
          windowId: m.windowId ?? undefined,
          index: m.index != null ? m.index + count : undefined,
        });
        ids.push(t.id);
        count++;
      }
      if (ids.length > 1) {
        const groupId = await chrome.tabs.group({ tabIds: ids });
        await chrome.tabGroups.update(groupId, { title: g.title || '', color: g.color || 'grey' });
      }
    }
    reply({ ok: true, count });
  })().catch(e => reply({ error: String(e.message || e) }));
  return true;
});

// ---------- Tastenkürzel ----------

chrome.commands.onCommand.addListener(async (command, tab) => {
  tab ??= (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (command === 'open-api') return openApi(tab?.url, null, tab);
  const m = tab?.url ? LS.match(await LS.projects(), tab.url) : null;
  if (!m) return;
  const next = m.project.envs[LS.shortcutTarget(m.project.envs, m.index, command)];
  if (next) chrome.tabs.update(tab.id, { url: LS.target(tab.url, next.origin) });
});

// ---------- API-Tester ----------

// Öffnet den API-Tester als Tab (oder holt den offenen nach vorne). Die aktuelle Seite wird mitgegeben,
// damit dort gleich das passende Projekt und die Umgebung gewählt sind.
async function openApi(url, projectId, tab, reqId, imp) {
  const fromPage = /^https?:/i.test(url || '') ? url : null;
  await chrome.storage.local.set({ ...(fromPage ? { from: fromPage } : {}), apiOpen: { url: fromPage, projectId: projectId ?? null, reqId: reqId ?? null, import: !!imp, at: Date.now() } });
  const app = chrome.runtime.getURL('app.html');
  const [ctx] = await chrome.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [app] });
  if (ctx) {
    await chrome.tabs.update(ctx.tabId, { active: true });
    await chrome.windows.update(ctx.windowId, { focused: true });
  } else {
    tab ??= (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
    await chrome.tabs.create({ url: app, ...(tab ? { index: tab.index + 1, windowId: tab.windowId } : {}) });
  }
}

// ---------- Branch auf lokalen Seiten anzeigen ----------
// Fragt beim Laden einer lokalen Projektseite den Branch beim Hilfsprogramm ab (höchstens alle 20 s pro Projekt).
const branchAsked = {};
async function refreshBranch(m) {
  try {
    if (!LS.isLocal(new URL(m.env.origin).hostname)) return;
    const v = await VCS.get();
    const repo = (v.repos[m.project.id] ?? []).find(r => r.path);
    if (!v.showOnPage || !repo || Date.now() - (branchAsked[m.project.id] ?? 0) < 20000) return;
    branchAsked[m.project.id] = Date.now();
    const res = await VCS.call({ op: 'info', path: repo.path }, v);
    const { vcsBranch = {} } = await chrome.storage.local.get('vcsBranch');
    if (vcsBranch[m.project.id]?.branch !== res.branch) await chrome.storage.local.set({ vcsBranch: { ...vcsBranch, [m.project.id]: { branch: res.branch, at: Date.now() } } });
  } catch {
    /* Hilfsprogramm fehlt oder Repo nicht erreichbar: einfach nichts anzeigen */
  }
}

// ---------- 1. Header-Presets: Regeln für declarativeNetRequest ----------
const ALL_TYPES = ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other'];

async function syncHeaders(projects, granted) {
  const rules = [];
  for (const p of projects) {
    for (const e of p.envs) {
      const list = HDR.of(e);
      if (!list.length || !granted.includes(LS.pattern(e.origin))) continue;
      rules.push({
        id: rules.length + 1,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          // Cookies werden ergänzt, alle anderen Header gesetzt
          requestHeaders: list.map(x => (/^cookie$/i.test(x.k) ? { header: 'cookie', operation: 'append', value: x.v } : { header: x.k, operation: 'set', value: x.v })),
        },
        condition: { urlFilter: `|${e.origin}/`, resourceTypes: ALL_TYPES },
      });
    }
  }
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old.map(r => r.id), addRules: rules }).catch(err => console.warn('Header-Regeln', err));
}

// ---------- 3. Fehler sammeln (JS-Fehler, console.error, fehlgeschlagene Requests) ----------
async function syncErrorScripts(granted) {
  const ids = [ERR_MAIN.id, ERR_BRIDGE.id];
  const have = await chrome.scripting.getRegisteredContentScripts({ ids });
  const on = (await PREFS.get()).errors && granted.length;
  if (!on) {
    if (have.length) await chrome.scripting.unregisterContentScripts({ ids: have.map(s => s.id) });
    return;
  }
  for (const s of [ERR_MAIN, ERR_BRIDGE]) {
    if (have.some(x => x.id === s.id)) await chrome.scripting.updateContentScripts([{ id: s.id, matches: granted }]);
    else await chrome.scripting.registerContentScripts([{ ...s, matches: granted }]).catch(err => console.warn('Fehler-Skript', err));
  }
}

const LOGS = new Map();
let logsLoaded = null;
const loadLogs = () =>
  (logsLoaded ??= chrome.storage.session.get('logs').then(d => {
    for (const [k, v] of Object.entries(d.logs ?? {})) if (!LOGS.has(Number(k))) LOGS.set(Number(k), v);
  }));
let logTimer;
const persistLogs = () => {
  clearTimeout(logTimer);
  logTimer = setTimeout(() => chrome.storage.session.set({ logs: Object.fromEntries(LOGS) }), 250);
};
const repaint = tabId => chrome.tabs.get(tabId).then(paint, () => {});

async function addLog(tabId, e) {
  if (tabId == null || tabId < 0 || !(await PREFS.get()).errors) return;
  await loadLogs();
  const list = LOGS.get(tabId) ?? [];
  const last = list[list.length - 1];
  if (last && last.kind === e.kind && last.msg === e.msg && last.src === e.src) {
    last.n = (last.n ?? 1) + 1;
    last.t = e.t;
  } else {
    list.push(e);
    if (list.length > 200) list.shift();
  }
  LOGS.set(tabId, list);
  persistLogs();
  repaint(tabId);
}

async function clearLogs(tabId) {
  await loadLogs();
  if (!LOGS.has(tabId)) return;
  LOGS.delete(tabId);
  persistLogs();
  repaint(tabId);
}

// Netzwerkfehler nur für Tabs, die gerade eine Projektseite zeigen
async function projectTab(tabId) {
  if (tabId < 0) return null;
  const t = await chrome.tabs.get(tabId).catch(() => null);
  return t?.url && LS.match(await LS.projects(), t.url) ? t : null;
}
async function netLog(d, what) {
  // Das Favicon fragt der Browser selbst an, das ist kein Fehler der Seite
  if (/\/favicon\.ico(\?|$)/.test(d.url) || !(await projectTab(d.tabId))) return;
  addLog(d.tabId, { kind: 'net', msg: `${d.method} ${what}`, src: d.url, rtype: d.type, t: Date.now() });
}

const WEB = { urls: ['http://*/*', 'https://*/*'] };
chrome.webRequest.onCompleted.addListener(d => {
  if (d.statusCode >= 400) netLog(d, String(d.statusCode));
  recDone(d);
}, WEB, ['responseHeaders']);
chrome.webRequest.onErrorOccurred.addListener(d => {
  // Abgebrochene oder von anderen Extensions blockierte Requests sind keine Fehler der Seite
  if (!/ERR_ABORTED|ERR_BLOCKED_BY_CLIENT|ERR_CACHE_MISS|ERR_BLOCKED_BY_RESPONSE/.test(d.error)) netLog(d, d.error.replace('net::', ''));
  recDone(d);
}, WEB);
// Neue Seite im Tab: alte Meldungen weg
chrome.webRequest.onBeforeRequest.addListener(
  d => {
    if (d.type === 'main_frame' && d.tabId >= 0) clearLogs(d.tabId);
    recStart(d);
  },
  WEB,
  ['requestBody']
);
chrome.webRequest.onSendHeaders.addListener(recHeaders, WEB, ['requestHeaders', 'extraHeaders']);
chrome.tabs.onRemoved.addListener(tabId => {
  clearLogs(tabId);
  // Sitzungsregel einer Vergleichsseite aufräumen
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [100000 + (tabId % 1000000)] }).catch(() => {});
  if (REC.has(tabId)) {
    REC.delete(tabId);
    persistRec();
  }
});

// ---------- 4. Requests mitschneiden ----------
const REC = new Map(); // tabId -> { on, origin, startedAt, items: [] }
let recLoaded = null;
const loadRec = () =>
  (recLoaded ??= chrome.storage.session.get('rec').then(d => {
    for (const [k, v] of Object.entries(d.rec ?? {})) if (!REC.has(Number(k))) REC.set(Number(k), v);
  }));
let recTimer;
const persistRec = () => {
  clearTimeout(recTimer);
  recTimer = setTimeout(() => chrome.storage.session.set({ rec: Object.fromEntries(REC) }), 250);
};
const recOf = d => (d.tabId >= 0 && REC.get(d.tabId)?.on && d.type === 'xmlhttprequest' ? REC.get(d.tabId) : null);

function bodyText(rb) {
  if (!rb) return '';
  if (rb.formData) return Object.entries(rb.formData).flatMap(([k, vs]) => vs.map(v => `${k}=${encodeURIComponent(v)}`)).join('&');
  if (rb.raw) {
    const parts = rb.raw.filter(x => x.bytes).map(x => new Uint8Array(x.bytes));
    const all = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
    let o = 0;
    for (const x of parts) all.set(x, (o += x.length) - x.length);
    return new TextDecoder().decode(all).slice(0, 200000);
  }
  return '';
}
function recStart(d) {
  const r = recOf(d);
  if (!r) return;
  if (r.items.length >= 500) return;
  r.items.push({ rid: d.requestId, method: d.method, url: d.url, body: bodyText(d.requestBody), headers: [], t: Date.now() });
  persistRec();
}
function recHeaders(d) {
  const it = recOf(d)?.items.find(x => x.rid === d.requestId);
  if (!it) return;
  it.headers = (d.requestHeaders ?? []).filter(x => !AP.SKIP_HEADERS.test(x.name)).map(x => ({ k: x.name, v: x.value ?? '' }));
  const ct = (d.requestHeaders ?? []).find(x => /^content-type$/i.test(x.name));
  if (ct) it.ct = ct.value;
  persistRec();
}
function recDone(d) {
  const it = recOf(d)?.items.find(x => x.rid === d.requestId);
  if (!it) return;
  it.status = d.statusCode ?? null;
  it.error = d.error ?? null;
  it.rct = (d.responseHeaders ?? []).find(x => /^content-type$/i.test(x.name))?.value ?? '';
  persistRec();
  repaint(d.tabId);
}

// Aufgenommene Requests ins Projekt übernehmen
async function recSave(tabId, projectId, keys) {
  await loadRec();
  const r = REC.get(tabId);
  const projects = await LS.projects();
  const p = projects.find(x => x.id === projectId);
  if (!r || !p) throw new Error('Nichts zum Übernehmen.');
  const seen = new Set();
  const reqs = [];
  for (const it of r.items) {
    const { path, params } = AP.fromUrl(it.url, p);
    const key = `${it.method} ${path}`;
    if (seen.has(key) || (keys && !keys.includes(key))) continue;
    seen.add(key);
    // Header-Presets der Umgebung nicht fest übernehmen, die kommen beim Senden ohnehin dazu
    let env = null;
    try {
      env = p.envs.find(e => e.origin === new URL(it.url).origin) ?? null;
    } catch {}
    const preset = new Set(HDR.of(env).map(x => x.k.toLowerCase()));
    const headers = it.headers.filter(x => !preset.has(x.k.toLowerCase())).map(x => ({ ...x, on: true }));
    reqs.push(AP.newReq({ method: it.method, path, params, headers, body: AP.bodyFrom(it.body, it.ct ?? '') }));
  }
  const { apiCols = [] } = await chrome.storage.local.get('apiCols');
  const d = new Date(r.startedAt);
  const name = `Aufnahme ${d.toLocaleDateString('de-CH')} ${d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`;
  apiCols.push({ id: AP.id(), name, projectId: p.id, reqs, folded: false });
  await chrome.storage.local.set({ apiCols });
  REC.delete(tabId);
  persistRec();
  repaint(tabId);
  return { count: reqs.length, name };
}

// ---------- 6. Daten einer Umgebung löschen (nur genau diese Adresse) ----------
async function clearData(origin, opts, tabId) {
  const done = [];
  const types = {};
  if (opts.cache) Object.assign(types, { cache: true, cacheStorage: true });
  if (opts.storage) Object.assign(types, { localStorage: true, indexedDB: true, fileSystems: true, webSQL: true });
  if (opts.sw) types.serviceWorkers = true;
  if (Object.keys(types).length) {
    await chrome.browsingData.remove({ origins: [origin] }, types);
    done.push(...[opts.cache && 'Cache', opts.storage && 'Speicher', opts.sw && 'Service Worker'].filter(Boolean));
  }
  // Session Storage gibt es nur in offenen Tabs
  if (opts.storage) {
    for (const t of await chrome.tabs.query({ url: `${origin}/*` }).catch(() => [])) {
      await chrome.scripting.executeScript({ target: { tabId: t.id }, func: () => sessionStorage.clear() }).catch(() => {});
    }
  }
  // Nur Cookies genau dieses Hosts. Cookies für die ganze Domain (z. B. .firma.ch) bleiben, damit andere Seiten eingeloggt bleiben.
  if (opts.cookies) {
    const host = new URL(origin).hostname;
    let n = 0;
    for (const c of await chrome.cookies.getAll({ url: origin + '/' })) {
      if (!(c.hostOnly || c.domain.replace(/^\./, '') === host)) continue;
      const proto = c.secure ? 'https:' : 'http:';
      await chrome.cookies.remove({ url: `${proto}//${host}${c.path}`, name: c.name, storeId: c.storeId }).catch(() => {});
      n++;
    }
    done.push(`${n} Cookies`);
  }
  if (tabId != null && opts.reload) await chrome.tabs.reload(tabId, { bypassCache: true }).catch(() => {});
  return done;
}

// Nachrichten für 3, 4 und 6
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  const run = fn =>
    fn().then(
      r => reply({ ok: true, ...r }),
      err => reply({ ok: false, error: String(err.message || err) })
    );
  switch (m?.type) {
    case 'log':
      if (sender.tab) addLog(sender.tab.id, { ...m.entry, t: m.entry.t ?? Date.now() });
      return false;
    case 'logs-get':
      run(async () => (await loadLogs(), { logs: LOGS.get(m.tabId) ?? [] }));
      return true;
    case 'logs-clear':
      run(async () => (await clearLogs(m.tabId), {}));
      return true;
    case 'rec-start':
      run(async () => {
        await loadRec();
        REC.set(m.tabId, { on: true, origin: m.origin, startedAt: Date.now(), items: [] });
        persistRec();
        repaint(m.tabId);
        return {};
      });
      return true;
    case 'rec-stop':
      run(async () => {
        await loadRec();
        const r = REC.get(m.tabId);
        if (r) r.on = false;
        persistRec();
        repaint(m.tabId);
        return {};
      });
      return true;
    case 'rec-get':
      run(async () => (await loadRec(), { rec: REC.get(m.tabId) ?? null }));
      return true;
    case 'rec-discard':
      run(async () => {
        await loadRec();
        REC.delete(m.tabId);
        persistRec();
        repaint(m.tabId);
        return {};
      });
      return true;
    case 'rec-save':
      run(() => recSave(m.tabId, m.projectId, m.keys));
      return true;
    case 'clear-data':
      run(async () => ({ done: await clearData(m.origin, m.opts, m.tabId) }));
      return true;
  }
  return false;
});
