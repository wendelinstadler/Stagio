const $ = id => document.getElementById(id);
let tab = null;
let editing = null;
let cache = [];

const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter(x => x != null && x !== false));
  return el;
};

const dot = name => {
  const d = h('span', { className: 'dot' });
  d.style.background = LS.color(name);
  return d;
};

// Server-Status-Punkt (wird nach der Prüfung eingefärbt)
const HSTATE = new Map(); // origin -> Ergebnis
let prefs = PREFS.DEFAULTS;
const hdot = (e, p) => {
  if (!prefs.health) return null;
  const d = h('span', { className: 'hdot', 'data-h': e.origin });
  paintH(d, HSTATE.get(e.origin));
  return d;
};
function paintH(d, r) {
  d.dataset.state = r?.state ?? 'wait';
  d.title = HEALTH.title(r);
}
function checkAll(projects) {
  if (!prefs.health) return;
  const seen = new Set();
  for (const p of projects)
    for (const e of p.envs) {
      if (seen.has(e.origin) || HSTATE.has(e.origin)) continue;
      seen.add(e.origin);
      HEALTH.check(e, p).then(r => {
        HSTATE.set(e.origin, r);
        document.querySelectorAll(`[data-h="${CSS.escape(e.origin)}"]`).forEach(d => paintH(d, r));
      });
    }
}

// Live-Schutz: Der erste Klick fragt nach, erst der zweite führt aus.
function guard(live, question, action) {
  return ev => {
    const b = ev.currentTarget;
    const restore = () => {
      if (!b.dataset.armed) return;
      delete b.dataset.armed;
      b.replaceChildren(...b._kids);
    };
    if (!live) return action(ev);
    if (b.dataset.armed) {
      restore();
      return action(ev);
    }
    b._kids = [...b.childNodes];
    b.dataset.armed = '1';
    b.replaceChildren(question);
    setTimeout(restore, 4000);
  };
}

const patterns = envs => [...new Set(envs.map(e => LS.pattern(e.origin)))];

async function missing(envs) {
  const out = [];
  for (const o of patterns(envs)) if (!(await chrome.permissions.contains({ origins: [o] }))) out.push(o);
  return out;
}

// Fragt Chrome nach Zugriff auf genau diese Adressen. Muss direkt im Klick aufgerufen werden.
// Schliesst sich das Popup dabei, richtet der Hintergrund die Markierung trotzdem ein.
function allow(origins) {
  if (!origins.length) return Promise.resolve(true);
  return chrome.permissions.request({ origins }).then(
    ok => {
      chrome.runtime.sendMessage({ type: 'sync' });
      return ok;
    },
    () => false
  );
}

function go(origin, newTab) {
  const url = LS.target(tab.url, origin);
  if (newTab) chrome.tabs.create({ url, index: tab.index + 1 });
  else chrome.tabs.update(tab.id, { url });
  window.close();
}

// Das Öffnen läuft im Hintergrund, damit es auch fertig wird, wenn sich das Popup schliesst.
function openGroups(groups) {
  chrome.runtime.sendMessage({ type: 'open', groups, windowId: tab?.windowId, index: tab ? tab.index + 1 : undefined });
}

// API-Tester öffnen, mit diesem Projekt (oder dem Projekt der aktuellen Seite).
function openApi(projectId) {
  chrome.runtime.sendMessage({ type: 'open-api', url: tab?.url, projectId: projectId ?? null });
  window.close();
}
$('api').addEventListener('click', () => openApi(null));
$('importLink').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'open-api', url: tab?.url, projectId: addTarget()?.id ?? null, import: true });
  window.close();
});

// ---------- Tabs oben ----------
// Neuer Bereich (z. B. Logs): hier eintragen und im HTML ein <div class="view" data-view="..."> anlegen.
const TABS = [
  { id: 'switch', label: 'Switcher' },
  { id: 'api', label: 'API' },
  { id: 'git', label: 'Branches' },
  { id: 'logs', label: 'Logs' },
];
let view = 'switch';
const tabCount = {};

function renderTabs() {
  put(
    $('tabs'),
    TABS.map(t =>
      h(
        'button',
        { className: 'tab', role: 'tab', 'aria-selected': String(t.id === view), onclick: () => showView(t.id) },
        t.label,
        tabCount[t.id] ? h('span', { className: 'n' }, String(tabCount[t.id])) : null
      )
    )
  );
}

function showView(id) {
  if (!TABS.some(t => t.id === id)) id = 'switch';
  view = id;
  document.querySelectorAll('.view').forEach(v => (v.hidden = v.dataset.view !== id));
  renderTabs();
  chrome.storage.local.set({ popupTab: id });
  if (id === 'git' && ready) renderVcs();
  if (id === 'logs' && ready) renderLogs();
}
let ready = false;

function resetForm() {
  editing = null;
  $('form').reset();
  $('err').textContent = '';
  $('formTitle').textContent = 'Projekt hinzufügen';
  $('cancel').hidden = true;
}

function projectCard(p, notAllowed) {
  const pages = p.pages ?? [];
  const urlsOf = e => pages.map(pg => LS.pageUrl(e, pg)).filter(Boolean);
  const group = e => ({ urls: urlsOf(e), title: `${p.name} · ${e.name}`, color: LS.groupColor(e.name) });
  return h(
    'div',
    { className: 'proj', 'data-p': p.id },
    h(
      'div',
      { className: 'head' },
      h('b', {}, p.name),
      h(
        'div',
        { style: 'white-space:nowrap' },
        pages.length > 0 &&
          h(
            'button',
            {
              className: 'link open',
              title: `Alle Seiten in allen Umgebungen öffnen (${p.envs.reduce((n, e) => n + urlsOf(e).length, 0)} Tabs)`,
              onclick: guard(p.envs.some(e => LS.isProd(e.name)), 'Auch Live öffnen?', () => openGroups(p.envs.map(group))),
            },
            'Alles öffnen'
          ),
        h('button', { className: 'link', title: 'Requests für dieses Projekt im API-Tester', onclick: () => openApi(p.id) }, 'API'),
        h(
          'button',
          {
            className: 'link',
            onclick: () => {
              editing = p.id;
              $('name').value = p.name;
              $('envs').value = p.envs.map(e => `${e.name} = ${e.origin}`).join('\n');
              $('pages').value = LS.pagesText(pages);
              $('formTitle').textContent = 'Projekt bearbeiten';
              $('cancel').hidden = false;
              $('name').focus();
            },
          },
          'Bearbeiten'
        ),
        h(
          'button',
          {
            className: 'link',
            onclick: async () => {
              await LS.save((await LS.projects()).filter(x => x.id !== p.id));
              if (editing === p.id) resetForm();
              render();
            },
          },
          'Löschen'
        )
      )
    ),
    pages.length
      ? p.envs.map(e => {
          const live = LS.isProd(e.name);
          return h(
            'div',
            { className: 'pages' },
            h('span', { className: 'who' }, dot(e.name), e.name, hdot(e, p)),
            pages.map(pg => {
              const url = LS.pageUrl(e, pg);
              return url && h('button', { className: 'chip', title: url, onclick: guard(live, 'Sicher?', () => openGroups([{ urls: [url] }])) }, pg.name);
            }),
            urlsOf(e).length > 1 &&
              h('button', { className: 'chip all', title: `Alle ${urlsOf(e).length} Seiten in ${e.name} öffnen`, onclick: guard(live, 'Sicher?', () => openGroups([group(e)])) }, 'Alle')
          );
        })
      : h('div', { className: 'muted envnames' }, p.envs.map(e => h('span', {}, e.name, hdot(e, p)))),
    notAllowed.length > 0 &&
      h(
        'div',
        { className: 'note muted' },
        h('span', {}, 'Markierung auf der Seite ist hier noch nicht erlaubt.'),
        h('button', { className: 'link open', onclick: () => allow(notAllowed).then(render) }, 'Erlauben')
      )
  );
}

async function render() {
  const projects = (cache = await LS.projects());
  const m = tab?.url ? LS.match(projects, tab.url) : null;

  if (m) {
    const others = m.project.envs.filter((_, i) => i !== m.index);
    $('now').replaceChildren(...[
      h('h1', {}, `Diese Seite · ${m.project.name}`),
      h(
        'div',
        { className: 'envs', style: 'margin-top:6px' },
        m.project.envs.map((e, i) =>
          h(
            'button',
            {
              className: 'env',
              'aria-current': String(i === m.index),
              title: i === m.index ? 'Aktuelle Umgebung' : 'Klick: hier öffnen · Ctrl/Cmd+Klick: neuer Tab',
              onclick: i === m.index ? () => {} : guard(LS.isProd(e.name), `Wirklich auf ${e.name} wechseln? Nochmals klicken.`, ev => go(e.origin, ev.ctrlKey || ev.metaKey)),
            },
            dot(e.name),
            h('b', {}, e.name),
            h('span', { className: 'o' }, e.origin),
            hdot(e, m.project)
          )
        )
      ),
      others.length > 1 &&
        h(
          'button',
          {
            className: 'link plain',
            onclick: guard(others.some(e => LS.isProd(e.name)), 'Auch auf Live öffnen? Nochmals klicken.', () =>
              openGroups([{ urls: others.map(e => LS.target(tab.url, e.origin)), title: m.project.name, color: 'grey' }])
            ),
          },
          'Diese Seite in allen anderen Umgebungen öffnen'
        ),
      headerLine(m),
      toolsRow(m),
      h('div', { id: 'toolPanel' }),
    ].filter(Boolean));
  } else {
    $('now').replaceChildren(
      h('div', { className: 'muted' }, projects.length ? 'Diese Seite gehört zu keinem Projekt.' : 'Noch kein Projekt. Lege unten eines an.')
    );
    // Nur eine wirklich lokale Seite wird als "Lokal" vorgeschlagen, nie eine normale Website.
    if (!editing && !projects.length && !$('envs').value && tab?.url?.startsWith('http')) {
      const u = new URL(tab.url);
      if (LS.isLocal(u.hostname)) $('envs').value = `Lokal = ${u.origin}\n`;
    }
  }

  renderQuick(projects, m);

  const gaps = $('marker').checked ? await Promise.all(projects.map(p => missing(p.envs))) : projects.map(() => []);
  $('list').replaceChildren(...projects.map((p, i) => projectCard(p, gaps[i])));
  checkAll(projects);
  checkTeam(projects);
  refreshLogsCount();
}

// Fügt die Adresse des aktuellen Tabs als neue Zeile ein. Den Namen wählt man selbst.
$('addCurrent').addEventListener('click', () => {
  const u = new URL(tab.url);
  const box = $('envs');
  const start = box.value && !box.value.endsWith('\n') ? box.value + '\n' : box.value;
  const name = LS.isLocal(u.hostname) ? 'Lokal' : 'Name';
  box.value = `${start}${name} = ${u.origin}\n`;
  box.focus();
  box.setSelectionRange(start.length, start.length + name.length);
});

$('cancel').addEventListener('click', () => {
  resetForm();
  render();
});

$('form').addEventListener('submit', async ev => {
  ev.preventDefault();
  $('err').textContent = '';
  let envs;
  let pages;
  try {
    envs = LS.parse($('envs').value);
    pages = LS.parsePages($('pages').value, envs);
  } catch (e) {
    $('err').textContent = e.message;
    return;
  }
  // Zuerst (noch im Klick) den Zugriff für die Markierung anfragen, dann speichern.
  const asked = $('marker').checked ? allow(patterns(envs)) : null;
  const projects = await LS.projects();
  const name = $('name').value.trim();
  const existing = projects.find(p => p.id === editing);
  if (existing) Object.assign(existing, { name, envs: AP.keepVars(existing.envs, envs), pages });
  else projects.push({ id: Date.now().toString(36), name, envs, pages });
  await LS.save(projects);
  resetForm();
  render();
  asked?.then(render);
});

$('marker').addEventListener('change', ev => {
  const asked = ev.target.checked ? allow(patterns(cache.flatMap(p => p.envs))) : null;
  chrome.storage.local.set({ marker: ev.target.checked }).then(render);
  asked?.then(render);
});

const forced = Number(new URLSearchParams(location.search).get('tab')) || null;
Promise.all([forced ? chrome.tabs.get(forced).then(t => [t]) : chrome.tabs.query({ active: true, currentWindow: true }), chrome.storage.local.get(['marker', 'popupTab']), PREFS.get()]).then(([[t], s, pr]) => {
  prefs = pr;
  showView(s.popupTab ?? 'switch');
  tab = t ?? null;
  $('addCurrent').hidden = !tab?.url?.startsWith('http');
  $('marker').checked = s.marker !== false;
  render();
  ready = true;
  if (view === 'git') renderVcs();
  if (view === 'logs') renderLogs();
  renderRec();
});

// ---------- Schnell-Requests (im API-Tester mit ★ markiert) ----------

const qEnv = {}; // gewählte Umgebung pro Projekt, nur solange das Popup offen ist
const qRes = new Map(); // letzte Antwort pro Request

async function renderQuick(projects, m) {
  const d = await chrome.storage.local.get(['apiCols', 'apiState', 'apiCookies']);
  const cols = d.apiCols ?? [];
  const pinned = p => cols.filter(c => c.projectId === p.id).flatMap(c => c.reqs.filter(r => r.pin));
  // Auf einer Projektseite nur dieses Projekt, sonst alle Projekte mit markierten Requests
  const list = (m ? [m.project] : projects).filter(p => pinned(p).length);
  tabCount.api = list.reduce((n, p) => n + pinned(p).length, 0);
  renderTabs();
  if (!list.length) {
    put(
      $('quick'),
      h(
        'div',
        { className: 'empty muted' },
        m && projects.some(p => pinned(p).length)
          ? `Für ${m.project.name} ist noch kein Request markiert.`
          : 'Noch keine Schnell-Requests.',
        h('br'),
        'Füge unten einen hinzu (Pfad oder cURL einfügen) oder markiere im API-Tester einen mit ☆.'
      )
    );
    return;
  }
  put(
    $('quick'),
    list.map(p => {
      if (qEnv[p.id] == null) qEnv[p.id] = m?.project.id === p.id ? m.index : d.apiState?.envSel?.[p.id] ?? 0;
      const env = p.envs[qEnv[p.id]] ?? p.envs[0];
      return h(
        'div',
        { className: 'qgroup', style: 'display:grid;gap:6px' },
        h(
          'div',
          { className: 'qhead' },
          h('h1', {}, m ? 'Schnell-Requests' : `Requests · ${p.name}`),
          p.envs.map((e, i) =>
            h('button', { className: 'qenv', 'aria-pressed': String(e === env), title: e.origin, onclick: () => { qEnv[p.id] = i; render(); } }, dot(e.name), e.name)
          )
        ),
        pinned(p).map(r => quickItem(p, env, r, d.apiCookies !== false))
      );
    })
  );
}

function quickItem(p, env, r, cookies) {
  const res = h('div');
  const key = `${r.id}@${env.name}`;
  const row = h(
    'button',
    { className: 'qrow', title: `${r.method} ${r.path}\nKlick: senden` },
    h('span', { className: `qm ${r.method}` }, r.method),
    h('span', { className: 'qp' }, h('code', {}, r.path || '/'), r.summary && h('span', {}, r.summary)),
    h('span', { className: 'qgo' }, 'Senden')
  );
  row.addEventListener(
    'click',
    guard(LS.isProd(env.name) && !['GET', 'HEAD'].includes(r.method), `${r.method} auf ${env.name}? Nochmals klicken.`, () => quickSend(p, env, r, cookies, res, key))
  );
  if (qRes.has(key)) showQuick(res, qRes.get(key), r, p);
  return h('div', { className: 'q' }, row, res);
}

function quickSend(p, env, r, cookies, box, key) {
  let req;
  try {
    req = AP.build(r, env, cookies);
  } catch (err) {
    return showQuick(box, { error: err.message }, r, p);
  }
  // Zugriff im Klick anfragen (zeigt nur beim ersten Mal einen Dialog)
  const pat = LS.pattern(req.url.origin);
  chrome.storage.local.get('apiOrigins').then(({ apiOrigins = [] }) => {
    if (!apiOrigins.includes(pat)) chrome.storage.local.set({ apiOrigins: [...apiOrigins, pat] });
  });
  const okP = chrome.permissions.request({ origins: [pat] }).catch(() => false);
  put(box, h('div', { className: 'qres muted' }, 'Wird gesendet …'));
  (async () => {
    if (!(await okP)) return showQuick(box, { error: `Kein Zugriff auf ${req.url.host} erlaubt.` }, r, p);
    const t0 = performance.now();
    let out;
    try {
      const resp = await fetch(req.url, req.init);
      const text = await resp.text();
      out = { status: resp.status, statusText: resp.statusText, ms: performance.now() - t0, text, ct: resp.headers.get('content-type') || '' };
    } catch (err) {
      out = { error: `Keine Antwort (${err.message}). Läuft der Server?` };
    }
    out.url = `${r.method} ${req.url.href}`;
    out.miss = req.miss;
    qRes.set(key, out);
    showQuick(box, out, r, p);
  })();
}

function showQuick(box, res, r, p) {
  const openBig = h('button', { className: 'link', style: 'padding:0', onclick: () => {
    chrome.runtime.sendMessage({ type: 'open-api', url: tab?.url, projectId: p.id, reqId: r.id });
    window.close();
  } }, 'Im API-Tester öffnen');
  if (res.error) {
    put(box, h('div', { className: 'qres' }, h('div', { className: 'bad' }, res.error), res.url && h('div', { className: 'muted' }, res.url), h('div', {}, openBig)));
    return;
  }
  let body = res.text;
  try {
    body = JSON.stringify(JSON.parse(res.text), null, 2);
  } catch {}
  const LIMIT = 20000;
  const cls = res.status >= 500 ? 's5' : res.status >= 400 ? 's4' : res.status >= 300 ? 's3' : 's2';
  const copy = h('button', { className: 'link', style: 'padding:0' }, 'Kopieren');
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(body);
    copy.textContent = 'Kopiert';
  });
  put(
    box,
    h(
      'div',
      { className: 'qres' },
      h(
        'div',
        { className: 'qmeta' },
        h('span', { className: `st ${cls}` }, `${res.status} ${res.statusText || AP.STATUS[res.status] || ''}`.trim()),
        h('span', { className: 'muted' }, AP.fmtMs(res.ms)),
        h('span', { className: 'grow' }),
        copy,
        openBig
      ),
      res.miss?.length > 0 && h('div', { className: 'warn' }, `Variable fehlt: ${res.miss.map(n => `{{${n}}}`).join(', ')}`),
      body ? h('pre', { className: 'qout' }, body.length > LIMIT ? body.slice(0, LIMIT) + '\n… (gekürzt, ganze Antwort im API-Tester)' : body) : h('div', { className: 'muted' }, '(leere Antwort)')
    )
  );
}

function put(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter(x => x != null && x !== false));
}

// ---------- Request hinzufügen (auch per eingefügtem cURL) ----------

let addProjects = [];
let parsed = null; // aus cURL erkannte Requests

function addTarget() {
  return addProjects.find(p => p.id === $('addProject').value) ?? null;
}

async function openAdd() {
  addProjects = await LS.projects();
  $('addErr').textContent = '';
  if (!addProjects.length) {
    $('addErr').textContent = 'Lege zuerst im Tab „Switcher“ ein Projekt an.';
  }
  const m = tab?.url ? LS.match(addProjects, tab.url) : null;
  const { apiState } = await chrome.storage.local.get('apiState');
  const pick = m?.project.id ?? apiState?.project ?? addProjects[0]?.id;
  put($('addProject'), addProjects.map(p => h('option', { value: p.id, selected: p.id === pick }, p.name)));
  $('addProject').hidden = addProjects.length < 2;
  $('addForm').hidden = false;
  $('addBtn').hidden = true;
  $('addPath').focus();
}

function closeAdd() {
  $('addForm').reset();
  $('addForm').hidden = true;
  $('addBtn').hidden = false;
  $('addBody').hidden = true;
  $('addInfo').textContent = '';
  $('addErr').textContent = '';
  parsed = null;
}

$('addBtn').addEventListener('click', openAdd);
$('addCancel').addEventListener('click', closeAdd);
$('addMethod').addEventListener('change', () => {
  $('addBody').hidden = ['GET', 'HEAD'].includes($('addMethod').value) && !$('addBody').value;
});

// Eingefügtes cURL oder eine volle Adresse erkennen
$('addPath').addEventListener('input', () => {
  const v = $('addPath').value.trim();
  $('addErr').textContent = '';
  parsed = null;
  $('addInfo').textContent = '';
  // Volle Adresse: passendes Projekt automatisch wählen
  const pickByUrl = url => {
    const hit = LS.match(addProjects, url);
    if (hit) $('addProject').value = hit.project.id;
  };
  if (/^curl(\.exe)?\s/i.test(v)) {
    try {
      const first = AP.shellWords(v).find(w => /^https?:\/\//i.test(w));
      if (first) pickByUrl(first);
      parsed = AP.parseCurls(v, addTarget());
    } catch (err) {
      $('addErr').textContent = err.message;
      return;
    }
    const r = parsed[0];
    $('addPath').value = r.path + (r.params.length ? '?' + r.params.map(p => `${p.k}=${p.v}`).join('&') : '');
    $('addMethod').value = r.method;
    $('addBody').value = r.body.text;
    $('addBody').hidden = !r.body.text && ['GET', 'HEAD'].includes(r.method);
    const bits = [r.headers.length && `${r.headers.length} Header`, r.body.text && 'Body'].filter(Boolean).join(', ');
    $('addInfo').textContent = parsed.length > 1 ? `${parsed.length} cURL-Befehle erkannt, alle werden gespeichert.` : `cURL erkannt${bits ? ` (${bits} übernommen)` : ''}.`;
  } else if (/^https?:\/\//i.test(v)) {
    pickByUrl(v);
    if (addTarget()?.envs.some(e => v.startsWith(e.origin))) $('addInfo').textContent = `Gehört zu ${addTarget().name}, wird als Pfad gespeichert und gilt in allen Umgebungen.`;
  }
});

$('addForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  const p = addTarget();
  if (!p) return ($('addErr').textContent = 'Lege zuerst im Tab „Switcher“ ein Projekt an.');
  const raw = $('addPath').value.trim();
  if (!raw) return ($('addErr').textContent = 'Pfad oder Adresse angeben, z. B. /api/users');
  const method = $('addMethod').value;
  const bodyText = $('addBody').value.trim();
  let reqs;
  if (parsed) {
    reqs = parsed;
    // Änderungen im Formular gelten für den ersten Request
    const { path, params } = AP.fromUrl(raw, p);
    Object.assign(reqs[0], { method, path, params, body: AP.bodyFrom(bodyText, reqs[0].headers.find(x => /^content-type$/i.test(x.k))?.v ?? '') });
  } else {
    const { path, params } = AP.fromUrl(raw, p);
    reqs = [AP.newReq({ method, path: path.startsWith('/') || /^https?:|^\{\{/.test(path) ? path : '/' + path, params, body: AP.bodyFrom(bodyText) })];
  }
  const name = $('addName').value.trim();
  if (name) reqs[0].summary = name;
  for (const r of reqs) r.pin = true;

  const { apiCols = [] } = await chrome.storage.local.get('apiCols');
  let col = apiCols.find(c => c.projectId === p.id && c.name === 'Schnell-Requests');
  if (!col) apiCols.push((col = { id: AP.id(), name: 'Schnell-Requests', projectId: p.id, reqs: [] }));
  col.reqs.push(...reqs);
  await chrome.storage.local.set({ apiCols });
  closeAdd();
  render();
});

// ---------- Branch Manager ----------

let V = null; // Einstellungen
const vcsState = new Map(); // pro Repo: info, branches, log, Meldungen

$('vcsSettings').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html#repos') });
  window.close();
});

async function renderVcs() {
  V = await VCS.get();
  const projects = await LS.projects();
  const m = tab?.url ? LS.match(projects, tab.url) : null;
  const withRepos = projects.filter(p => (V.repos[p.id] ?? []).some(r => r.path));
  const list = m && withRepos.includes(m.project) ? [m.project] : withRepos;
  if (!list.length) {
    put(
      $('vcsBox'),
      h(
        'div',
        { className: 'empty muted' },
        'Noch kein Repo eingerichtet.',
        h('br'),
        'Unten auf „Branch Manager einrichten“ klicken und pro Projekt den Ordner angeben.'
      )
    );
    return;
  }
  put(
    $('vcsBox'),
    list.map(p => h('div', { className: 'vgroup' }, (list.length > 1 || !m) && h('h1', {}, p.name), V.repos[p.id].filter(r => r.path).map(r => repoCard(p, r))))
  );
}

function repoCard(p, r) {
  const el = h('div', { className: 'rc' });
  if (!vcsState.has(r.id)) vcsState.set(r.id, {});
  const st = vcsState.get(r.id);
  const draw = () => put(el, cardBody(p, r, st, draw));
  draw();
  if (!st.info && !st.busy) act(p, r, st, draw, 'info');
  return el;
}

const DONE = { switch: 'Gewechselt.', create: 'Branch erstellt.', pull: 'Pull fertig.', push: 'Push fertig.', fetch: 'Abgerufen.' };

async function act(p, r, st, draw, op, extra = {}) {
  st.busy = op;
  st.err = null;
  if (op !== 'branches' && op !== 'log') st.msg = null;
  draw();
  try {
    const res = await VCS.call({ op, path: r.path, ...extra }, V);
    st.vcs = res.vcs;
    if (op === 'info') st.info = res;
    if (res.info) st.info = res.info;
    if (op === 'branches') st.branches = res.branches;
    if (op === 'log') st.log = res.commits;
    if (DONE[op]) {
      st.branches = null;
      st.log = null;
      st.openList = false;
      st.openNew = false;
      const out = (res.out ?? '').trim().split('\n').slice(-3).join('\n');
      st.msg = [res.note ?? DONE[op], out].filter(Boolean).join('\n');
    }
    // Branch für die Markierung auf lokalen Seiten merken (erstes Repo des Projekts)
    if (st.info && V.repos[p.id]?.find(x => x.path)?.id === r.id) {
      const { vcsBranch = {} } = await chrome.storage.local.get('vcsBranch');
      if (vcsBranch[p.id]?.branch !== st.info.branch) chrome.storage.local.set({ vcsBranch: { ...vcsBranch, [p.id]: { branch: st.info.branch, at: Date.now() } } });
    }
  } catch (err) {
    st.err = err.message;
  }
  st.busy = null;
  draw();
  if (st.openLog && !st.log && op !== 'log' && !st.err && V.features.log) act(p, r, st, draw, 'log', { count: V.logCount });
}

function cardBody(p, r, st, draw) {
  const F = V.features;
  const i = st.info;
  const run = (op, extra) => act(p, r, st, draw, op, extra);
  const busy = !!st.busy;
  const btn = (label, onclick, opts = {}) => h('button', { className: 'mini' + (opts.on ? ' on' : ''), disabled: busy && !opts.always, title: opts.title, onclick }, label);

  const head = h(
    'div',
    { className: 'rhead' },
    st.vcs && h('span', { className: `vcs ${st.vcs}` }, st.vcs),
    h('b', { title: r.path }, r.name || r.path),
    h('button', { className: 'link', style: 'padding:0', disabled: busy, title: 'Neu laden', onclick: () => run('info') }, '⟳')
  );
  if (!i) return [head, st.busy ? h('div', { className: 'busy' }, 'Lade …') : null, st.err && h('div', { className: 'rerr' }, st.err)];

  const changed = i.changes?.length ?? 0;
  const parts = [head];

  if (F.branch) parts.push(h('div', { className: 'br' }, '⎇', h('b', {}, i.branch || '?'), i.bookmark && h('span', { className: 'muted' }, `★ ${i.bookmark}`)));

  if (F.sync) {
    const files = (i.changes ?? []).slice(0, 25).map(c => `${c.s} ${c.f}`).join('\n') + (changed > 25 ? `\n… ${changed - 25} weitere` : '');
    parts.push(
      h(
        'div',
        { className: 'stat' },
        changed ? h('span', { className: 'pill2 warn2', title: files }, `${changed} geändert`) : h('span', { className: 'pill2' }, 'sauber'),
        i.ahead > 0 && h('span', { className: 'pill2 up', title: st.vcs === 'hg' ? 'Draft-Commits auf diesem Branch' : `Vor ${i.upstream ?? 'Upstream'}` }, `${i.ahead} nicht gepusht`),
        i.behind > 0 && h('span', { className: 'pill2 warn2' }, `${i.behind} hinter`),
        st.vcs === 'git' && !i.upstream && h('span', { className: 'pill2', title: 'Push legt den Branch auf origin an' }, 'noch nicht auf Server')
      ),
      h(
        'div',
        { className: 'acts' },
        btn('↓ Pull', () => run('pull', { mode: V.gitPull })),
        btn('↑ Push', guard(true, `Push ${i.branch}?`, () => run('push'))),
        st.vcs === 'git' && btn('Fetch', () => run('fetch'), { title: 'Neues vom Server holen, ohne zu mergen' }),
        F.switch && btn('Wechseln', () => toggle('openList'), { on: st.openList }),
        F.switch && btn('+ Neu', () => toggle('openNew'), { on: st.openNew }),
        F.log && btn('Commits', () => toggle('openLog'), { on: st.openLog })
      )
    );
  } else if (F.switch || F.log) {
    parts.push(
      h(
        'div',
        { className: 'acts' },
        F.switch && btn('Wechseln', () => toggle('openList'), { on: st.openList }),
        F.switch && btn('+ Neu', () => toggle('openNew'), { on: st.openNew }),
        F.log && btn('Commits', () => toggle('openLog'), { on: st.openLog })
      )
    );
  }

  function toggle(k) {
    st[k] = !st[k];
    if (k === 'openList' && st.openList) st.openNew = false;
    if (k === 'openNew' && st.openNew) st.openList = false;
    draw();
    if (k === 'openList' && st.openList && !st.branches) run('branches');
    if (k === 'openLog' && st.openLog && !st.log) run('log', { count: V.logCount });
    if (k === 'openList' && st.openList) el?.focus?.();
  }
  let el = null;

  if (F.switch && st.openList) {
    const filter = h('input', { value: st.filter ?? '', placeholder: 'Branch suchen …', spellcheck: false });
    const listEl = h('div', { className: 'blist' });
    const fill = () => {
      const q = (st.filter ?? '').toLowerCase();
      const items = (st.branches ?? []).filter(b => b.name.toLowerCase().includes(q)).slice(0, 60);
      put(
        listEl,
        !st.branches ? h('div', { className: 'busy', style: 'padding:6px 8px' }, 'Lade Branches …') : !items.length ? h('div', { className: 'busy', style: 'padding:6px 8px' }, 'Kein Treffer') : null,
        items.map(b => {
          const cur = b.name === i.branch || b.name === i.bookmark;
          const label = [b.remote && T('nur Server'), b.kind === 'bookmark' && 'Bookmark', VCS.ago(b.date)].filter(Boolean).join(' · ');
          const item = h('button', { className: 'bitem' + (cur ? ' cur' : ''), title: cur ? 'Aktueller Branch' : `Zu ${b.name} wechseln` }, cur ? '● ' : '', b.name, h('span', { className: 't' }, label));
          if (!cur) item.addEventListener('click', guard(changed > 0, `${changed} Änderungen offen. Trotzdem?`, () => run('switch', { branch: b.name })));
          return item;
        })
      );
    };
    filter.addEventListener('input', () => {
      st.filter = filter.value;
      fill();
    });
    fill();
    el = filter;
    parts.push(filter, listEl);
    setTimeout(() => !busy && filter.focus(), 0);
  }

  if (F.switch && st.openNew) {
    // Ticket aus einer offenen Jira-Seite übernehmen, z. B. …/browse/ABC-123
    if (st.newTicket == null) {
      const t = /\/browse\/([A-Z][A-Z0-9]+-\d+)/.exec(tab?.url ?? '')?.[1] ?? /selectedIssue=([A-Z][A-Z0-9]+-\d+)/.exec(tab?.url ?? '')?.[1] ?? '';
      st.newTicket = t;
      st.newTitle = t ? (tab?.title ?? '').replace(/^\[[^\]]+\]\s*/, '').replace(/\s*[-–|]\s*Jira.*$/i, '') : '';
    }
    const ticket = h('input', { value: st.newTicket, placeholder: 'Ticket, z. B. ABC-123', spellcheck: false });
    const title = h('input', { value: st.newTitle, placeholder: 'Titel, z. B. Login reparieren' });
    const name = h('input', { value: st.newName ?? VCS.branchName(V.template, st.newTicket, st.newTitle), className: '', style: 'font-family:ui-monospace,Consolas,monospace', spellcheck: false });
    const upd = () => {
      st.newTicket = ticket.value;
      st.newTitle = title.value;
      if (!st.nameEdited) name.value = VCS.branchName(V.template, ticket.value, title.value);
    };
    ticket.addEventListener('input', upd);
    title.addEventListener('input', upd);
    name.addEventListener('input', () => {
      st.nameEdited = true;
      st.newName = name.value;
    });
    const create = () => {
      const b = name.value.trim();
      if (!b) return;
      st.newName = null;
      st.nameEdited = false;
      st.newTicket = null;
      run('create', { branch: b, kind: V.hgNew });
    };
    name.addEventListener('keydown', ev => ev.key === 'Enter' && create());
    parts.push(
      h(
        'div',
        { className: 'newb' },
        h('div', { className: 'two' }, ticket, title),
        name,
        h(
          'div',
          { className: 'row' },
          h('span', { className: 'muted', style: 'margin-right:auto' }, st.vcs === 'hg' ? (V.hgNew === 'bookmark' ? 'als Bookmark' : 'als Named Branch') : `ab ${i.branch}`),
          h('button', { className: 'btn', disabled: busy, onclick: create }, 'Erstellen')
        )
      )
    );
    setTimeout(() => !busy && (st.newTicket ? title : ticket).focus(), 0);
  }

  if (F.log && st.openLog) {
    parts.push(
      h(
        'div',
        { className: 'commits' },
        !st.log ? h('div', { className: 'busy' }, 'Lade Commits …') : !st.log.length ? h('div', { className: 'busy' }, 'Noch keine Commits.') : null,
        (st.log ?? []).map(c => h('div', { className: 'commit', title: `${c.id} · ${c.author}` }, h('code', {}, c.id.slice(0, 7)), h('span', {}, c.msg), h('small', {}, `${c.author} · ${VCS.ago(c.date)}`)))
      )
    );
  }

  if (st.busy && !['branches', 'log'].includes(st.busy)) parts.push(h('div', { className: 'busy' }, { info: 'Lade …', pull: 'Pull läuft …', push: 'Push läuft …', fetch: 'Fetch läuft …', switch: 'Wechsle …', create: 'Erstelle …' }[st.busy]));
  if (st.err) parts.push(h('div', { className: 'rerr' }, st.err));
  // Eine Zeile pro Element, damit unsere Meldung übersetzt wird und die git/hg-Ausgabe unverändert bleibt
  if (st.msg) parts.push(h('div', { className: 'rmsg' }, st.msg.split('\n').map(l => h('div', {}, l))));
  return parts;
}

// ---------- 1. Header-Preset der aktuellen Umgebung an/aus ----------

function headerLine(m) {
  const e = m.env;
  let list = [];
  try {
    list = HDR.parse(e.headers);
  } catch {}
  if (!list.length) return null;
  const on = e.headersOn !== false;
  return h(
    'div',
    { className: 'hline' },
    h('span', { className: 'hbadge' + (on ? ' on' : '') }, on ? 'Header aktiv' : 'Header aus'),
    h('span', { className: 'o', title: list.map(x => `${x.k}: ${x.v}`).join('\n') }, list.map(x => x.k).join(', ')),
    h(
      'button',
      {
        className: 'link open',
        style: 'padding:0;margin-left:auto',
        onclick: async () => {
          const projects = await LS.projects();
          const env = projects.find(p => p.id === m.project.id)?.envs[m.index];
          if (!env) return;
          env.headersOn = !on;
          await LS.save(projects);
          // Kurz warten, bis die Regeln neu gesetzt sind, dann neu laden
          setTimeout(() => chrome.tabs.reload(tab.id), 300);
          render();
        },
      },
      on ? 'Aus + neu laden' : 'An + neu laden'
    )
  );
}

// ---------- 5. und 6. Werkzeuge für die aktuelle Seite ----------

function toolsRow(m) {
  const panel = () => $('toolPanel');
  return h(
    'div',
    { className: 'tools' },
    m.project.envs.length > 1 &&
      h(
        'button',
        {
          className: 'mini',
          title: 'Diese Seite in zwei Umgebungen nebeneinander ansehen',
          onclick: () => {
            const other = m.project.envs.find((_, i) => i !== m.index);
            const u = new URL(tab.url);
            const q = new URLSearchParams({ p: m.project.id, a: m.env.origin, b: other.origin, path: u.pathname + u.search });
            chrome.tabs.create({ url: chrome.runtime.getURL('compare.html?' + q), index: tab.index + 1 });
            window.close();
          },
        },
        '⇆ Vergleichen'
      ),
    h('button', { className: 'mini', onclick: () => clearPanel(m, panel()) }, '🧹 Daten löschen')
  );
}

function clearPanel(m, box) {
  if (box.childElementCount) return put(box);
  const live = LS.isProd(m.env.name);
  const opt = (k, label, checked, hint) => {
    const cb = h('input', { type: 'checkbox', checked, style: 'width:auto' });
    cb.dataset.k = k;
    return h('label', { className: 'copt', title: hint ?? '' }, cb, h('span', {}, label, hint && h('small', {}, hint)));
  };
  const status = h('div', { className: 'muted' });
  const go = async () => {
    const opts = { reload: true };
    box.querySelectorAll('input[data-k]').forEach(cb => (opts[cb.dataset.k] = cb.checked));
    status.textContent = 'Lösche …';
    const r = await chrome.runtime.sendMessage({ type: 'clear-data', origin: m.env.origin, opts, tabId: tab.id });
    status.textContent = r?.ok ? `Gelöscht: ${r.done.map(T).join(', ') || T('nichts')}. Seite wird neu geladen.` : r?.error ?? 'Fehler';
  };
  put(
    box,
    h(
      'div',
      { className: 'cpanel' },
      h('b', {}, `Daten von ${new URL(m.env.origin).host} löschen`),
      h('div', { className: 'muted' }, 'Nur diese Adresse. Andere Seiten und Logins bleiben unberührt.'),
      opt('cache', 'Cache', true),
      opt('storage', 'Local/Session Storage und IndexedDB', true),
      opt('sw', 'Service Worker', true),
      opt('cookies', 'Cookies (meldet dich hier ab)', false, LS.isLocal(new URL(m.env.origin).hostname) ? 'Gilt für alle Ports dieses Hosts. Cookies der ganzen Domain bleiben.' : 'Nur Cookies genau dieses Hosts. Cookies der ganzen Domain bleiben.'),
      h('div', { className: 'row' }, h('button', { className: 'btn', onclick: guard(live, `Auf ${m.env.name}? Nochmals klicken.`, go) }, 'Löschen und neu laden')),
      status
    )
  );
}

// ---------- 3. Logs-Tab ----------

let logFilter = 'all';
async function refreshLogsCount() {
  if (!tab?.id) return;
  const r = await chrome.runtime.sendMessage({ type: 'logs-get', tabId: tab.id }).catch(() => null);
  tabCount.logs = (r?.logs ?? []).reduce((n, x) => n + (x.n ?? 1), 0);
  renderTabs();
}

async function renderLogs() {
  const box = $('logBox');
  if (!prefs.errors) {
    put(box, h('div', { className: 'empty muted' }, 'Fehler sammeln ist ausgeschaltet.', h('br'), h('button', { className: 'link open', style: 'padding:0', onclick: () => chrome.runtime.openOptionsPage() }, 'In den Einstellungen einschalten')));
    return;
  }
  const projects = await LS.projects();
  const m = tab?.url ? LS.match(projects, tab.url) : null;
  if (!m) {
    put(box, h('div', { className: 'empty muted' }, 'Fehler werden auf den Seiten deiner Projekte gesammelt.', h('br'), 'Diese Seite gehört zu keinem Projekt.'));
    return;
  }
  const r = await chrome.runtime.sendMessage({ type: 'logs-get', tabId: tab.id });
  const logs = r?.logs ?? [];
  tabCount.logs = logs.reduce((n, x) => n + (x.n ?? 1), 0);
  renderTabs();
  const KINDS = { js: 'JS', console: 'Konsole', net: 'Netz' };
  const shown = logs.filter(x => logFilter === 'all' || x.kind === logFilter).slice().reverse();
  const asText = () => logs.map(x => `[${new Date(x.t).toLocaleTimeString(I18N.locale)}] ${T(KINDS[x.kind] ?? x.kind)}: ${x.msg}${x.src ? `\n    ${x.src}` : ''}${x.n > 1 ? ` (${x.n}×)` : ''}`).join('\n');
  const copy = h('button', { className: 'link', style: 'padding:0' }, 'Kopieren');
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(`${tab.url}\n\n${asText()}`);
    copy.textContent = 'Kopiert';
  });
  put(
    box,
    h(
      'div',
      { className: 'lhead' },
      ['all', 'js', 'console', 'net'].map(k => {
        const n = k === 'all' ? logs.length : logs.filter(x => x.kind === k).length;
        return h('button', { className: 'mini' + (logFilter === k ? ' on' : ''), onclick: () => ((logFilter = k), renderLogs()) }, `${k === 'all' ? 'Alle' : KINDS[k]} ${n}`);
      }),
      h('span', { style: 'flex:1' }),
      logs.length > 0 && copy,
      logs.length > 0 &&
        h(
          'button',
          {
            className: 'link',
            onclick: async () => {
              await chrome.runtime.sendMessage({ type: 'logs-clear', tabId: tab.id });
              renderLogs();
            },
          },
          'Leeren'
        )
    ),
    !shown.length
      ? h('div', { className: 'empty muted' }, logs.length ? 'Keine Einträge in diesem Filter.' : 'Keine Fehler auf dieser Seite. 🎉')
      : h(
          'div',
          { className: 'logs' },
          shown.map(x =>
            h(
              'div',
              { className: `log k-${x.kind}` },
              h('span', { className: 'lk' }, KINDS[x.kind] ?? x.kind),
              h('div', { className: 'lm' }, h('div', {}, x.msg, x.n > 1 && h('span', { className: 'ln' }, ` ${x.n}×`)), x.src && h('small', { title: x.src }, x.src)),
              h('span', { className: 'lt' }, new Date(x.t).toLocaleTimeString(I18N.locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
            )
          )
        )
  );
}

// ---------- 4. Requests aufnehmen ----------

let recProjects = [];
async function renderRec() {
  const box = $('recBox');
  if (!tab?.id || !/^https?:/.test(tab.url ?? '')) return put(box);
  const r = (await chrome.runtime.sendMessage({ type: 'rec-get', tabId: tab.id }).catch(() => null))?.rec;
  if (!r) {
    put(
      box,
      h(
        'button',
        {
          className: 'recbtn',
          title: 'Zeichnet alle API-Aufrufe (Fetch/XHR) dieses Tabs auf, bis du stoppst',
          onclick: async () => {
            const origin = new URL(tab.url).origin;
            // Zugriff im Klick anfragen
            const ok = await chrome.permissions.request({ origins: [LS.pattern(origin)] }).catch(() => false);
            if (!ok) return;
            const { apiOrigins = [] } = await chrome.storage.local.get('apiOrigins');
            if (!apiOrigins.includes(LS.pattern(origin))) await chrome.storage.local.set({ apiOrigins: [...apiOrigins, LS.pattern(origin)] });
            await chrome.runtime.sendMessage({ type: 'rec-start', tabId: tab.id, origin });
            renderRec();
          },
        },
        h('span', { className: 'rdot' }),
        'Requests dieser Seite aufnehmen'
      )
    );
    return;
  }
  const uniq = [];
  const projects = (recProjects = await LS.projects());
  const m = LS.match(projects, tab.url);
  const target = m?.project ?? projects[0];
  for (const it of r.items) {
    const { path } = AP.fromUrl(it.url, target);
    const key = `${it.method} ${path}`;
    const u = uniq.find(x => x.key === key);
    if (u) u.n++;
    else uniq.push({ key, method: it.method, path, status: it.status, n: 1 });
  }
  if (r.on) {
    put(
      box,
      h(
        'div',
        { className: 'recrun' },
        h('span', { className: 'rdot live' }),
        h('span', { style: 'flex:1' }, `Aufnahme läuft · ${uniq.length} ${uniq.length === 1 ? 'Request' : 'Requests'}`),
        h('button', { className: 'link', onclick: () => renderRec() }, '⟳'),
        h('button', { className: 'btn', onclick: async () => (await chrome.runtime.sendMessage({ type: 'rec-stop', tabId: tab.id }), renderRec()) }, 'Stopp')
      ),
      h('div', { className: 'muted' }, 'Klick dich jetzt durch die Seite. Das Popup darf zu sein, die Aufnahme läuft weiter.')
    );
    return;
  }
  // Gestoppt: Auswahl übernehmen
  const sel = h('select', {}, projects.map(p => h('option', { value: p.id, selected: p === target }, p.name)));
  const checks = uniq.map(u => {
    const cb = h('input', { type: 'checkbox', checked: true, style: 'width:auto' });
    cb.dataset.key = u.key;
    return h(
      'label',
      { className: 'ritem' },
      cb,
      h('span', { className: `qm ${u.method}` }, u.method),
      h('code', { title: u.path }, u.path),
      h('span', { className: 'muted' }, [u.status && String(u.status), u.n > 1 && `${u.n}×`].filter(Boolean).join(' · '))
    );
  });
  const msg = h('div', { className: 'muted' });
  put(
    box,
    h(
      'div',
      { className: 'recdone' },
      h('b', {}, `${uniq.length} ${uniq.length === 1 ? 'Request' : 'Requests'} aufgenommen`),
      uniq.length ? h('div', { className: 'rlist' }, checks) : h('div', { className: 'muted' }, 'Keine API-Aufrufe erkannt.'),
      projects.length > 1 && sel,
      !projects.length && h('div', { className: 'bad' }, 'Lege zuerst im Switcher ein Projekt an.'),
      h(
        'div',
        { className: 'row' },
        h('button', { className: 'link', onclick: async () => (await chrome.runtime.sendMessage({ type: 'rec-discard', tabId: tab.id }), renderRec()) }, 'Verwerfen'),
        uniq.length > 0 &&
          projects.length > 0 &&
          h(
            'button',
            {
              className: 'btn',
              onclick: async () => {
                const keys = checks.map(l => l.querySelector('input')).filter(cb => cb.checked).map(cb => cb.dataset.key);
                const res = await chrome.runtime.sendMessage({ type: 'rec-save', tabId: tab.id, projectId: projects.length > 1 ? sel.value : projects[0].id, keys });
                if (!res?.ok) return (msg.textContent = res?.error ?? 'Fehler');
                put(box, h('div', { className: 'muted' }, `${res.count} Requests als „${res.name}“ im API-Tester gespeichert.`, ' ', h('button', { className: 'link open', style: 'padding:0', onclick: () => openApi(projects.length > 1 ? sel.value : projects[0].id) }, 'Öffnen ↗')));
              },
            },
            'In den API-Tester übernehmen'
          )
      ),
      msg
    )
  );
}

// ---------- 8. Neue Team-Konfiguration im Repo melden ----------

// Ergebnis pro Projekt merken, damit ein neues Zeichnen das Hilfsprogramm nicht erneut fragt
const teamReads = new Map();
async function checkTeam(projects) {
  const v = await VCS.get();
  for (const p of projects) {
    const repo = (v.repos[p.id] ?? []).find(r => r.path);
    if (!repo) continue;
    if (!teamReads.has(p.id)) teamReads.set(p.id, VCS.call({ op: 'readTeam', path: repo.path }, v));
    teamReads
      .get(p.id)
      .then(r => {
        if (!r.exists || TEAM.hash(r.text) === p.teamHash) return;
        let d;
        try {
          d = TEAM.parse(r.text);
        } catch {
          return;
        }
        if (p.teamKey && d.key && d.key !== p.teamKey) return;
        const card = document.querySelector(`.proj[data-p="${p.id}"]`);
        if (!card || card.querySelector('.teambar')) return;
        const btn = h('button', { className: 'link open', style: 'padding:0' }, 'Übernehmen');
        const bar = h('div', { className: 'teambar' }, h('span', {}, p.teamHash ? 'Neue Team-Konfiguration im Repo' : 'Team-Konfiguration im Repo gefunden'), btn);
        btn.addEventListener('click', async () => {
          try {
            const { apiCols = [] } = await chrome.storage.local.get('apiCols');
            const res = TEAM.apply(r.text, await LS.projects(), apiCols);
            await LS.save(res.projects);
            await chrome.storage.local.set({ apiCols: res.cols });
            teamReads.delete(p.id);
            bar.replaceChildren(h('span', {}, `Übernommen: ${res.envs} Umgebungen, ${res.reqs} Requests.`));
            setTimeout(render, 1200);
          } catch (err) {
            bar.replaceChildren(h('span', { className: 'bad' }, err.message));
          }
        });
        card.append(bar);
      })
      .catch(() => {});
  }
}
