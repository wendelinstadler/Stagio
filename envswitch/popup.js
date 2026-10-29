const $ = id => document.getElementById(id);
let tab = null;
let editing = null;
let cache = [];

const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
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
    { className: 'proj' },
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
            h('span', { className: 'who' }, dot(e.name), e.name),
            pages.map(pg => {
              const url = LS.pageUrl(e, pg);
              return url && h('button', { className: 'chip', title: url, onclick: guard(live, 'Sicher?', () => openGroups([{ urls: [url] }])) }, pg.name);
            }),
            urlsOf(e).length > 1 &&
              h('button', { className: 'chip all', title: `Alle ${urlsOf(e).length} Seiten in ${e.name} öffnen`, onclick: guard(live, 'Sicher?', () => openGroups([group(e)])) }, 'Alle')
          );
        })
      : h('div', { className: 'muted' }, p.envs.map(e => e.name).join(' · ')),
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
            h('span', { className: 'o' }, e.origin)
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

Promise.all([chrome.tabs.query({ active: true, currentWindow: true }), chrome.storage.local.get('marker')]).then(([[t], s]) => {
  tab = t ?? null;
  $('addCurrent').hidden = !tab?.url?.startsWith('http');
  $('marker').checked = s.marker !== false;
  render();
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
  if (!list.length) {
    put(
      $('quick'),
      cols.length > 0 && h('div', { className: 'muted' }, 'Tipp: Im API-Tester einen Request mit ☆ markieren, dann kannst du ihn hier schnell senden.')
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
