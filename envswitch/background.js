importScripts('common.js');

// Zeigt auf dem Icon an, in welcher Umgebung der Tab gerade ist.
// Die Adresse eines Tabs ist nur sichtbar, wenn sie zu einer erlaubten Projekt-Adresse gehört.
async function paint(tab) {
  if (!tab?.id) return;
  try {
    const m = tab.url ? LS.match(await LS.projects(), tab.url) : null;
    if (m) refreshBranch(m);
    await chrome.action.setBadgeText({ tabId: tab.id, text: m ? m.env.name.slice(0, 4).toUpperCase() : '' });
    if (m) {
      await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: LS.color(m.env.name) });
      await chrome.action.setBadgeTextColor({ tabId: tab.id, color: '#ffffff' });
    }
  } catch {
    /* Tab wurde inzwischen geschlossen */
  }
}

const paintAll = async () => (await chrome.tabs.query({})).forEach(paint);

// ---------- Markierung nur auf den Adressen der eigenen Projekte ----------

const MARKER = { id: 'marker', js: ['common.js', 'marker.js'], runAt: 'document_idle', persistAcrossSessions: true };

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
  if (ch.projects || ch.marker || ch.apiOrigins) sync();
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
