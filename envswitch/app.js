// API-Tester von EnvSwitch. Projekte und Umgebungen sind dieselben wie im Popup (Speicher "projects"),
// die Requests liegen in "apiCols" und gehören jeweils zu einem Projekt.
const $ = id => document.getElementById(id);
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const NO_BODY = ['GET', 'HEAD'];

let S = { projects: [], cols: [], project: null, envSel: {}, cookies: true, from: null, apiOrigins: [] };
const opened = new Set(); // aufgeklappte Requests
const responses = new Map(); // letzte Antwort pro Request (nur solange der Tab offen ist)
const tabOf = new Map(); // gewählter Reiter pro Request
const running = new Map(); // laufende Anfragen (zum Abbrechen)
const varsOpen = new Set(); // Umgebungen mit offenem Variablen-Feld
let editing = null; // Projekt-ID im Formular
let formOpen = false; // Formular für neues Projekt offen
let filter = '';

const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  el.append(...kids.flat(Infinity).filter(x => x != null && x !== false));
  return el;
};

// replaceChildren ohne leere Werte (false/null), damit kein "false" auf der Seite landet
const put = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(x => x != null && x !== false));

const dot = name => {
  const d = h('span', { className: 'dot' });
  d.style.background = LS.color(name);
  return d;
};

const project = () => S.projects.find(p => p.id === S.project) ?? null;
const projCols = () => S.cols.filter(c => c.projectId === S.project);
const activeEnv = () => {
  const p = project();
  return p ? p.envs[S.envSel[p.id] ?? 0] ?? p.envs[0] ?? null : null;
};

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}
let lastSaved = '';
// Chrome speichert Objekte mit sortierten Schlüsseln: zum Vergleichen darum sortiert serialisieren
const stable = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(n => [n, x[n]])) : x));
function saveNow() {
  clearTimeout(saveTimer);
  lastSaved = stable(S.cols);
  return chrome.storage.local.set({ apiCols: S.cols, apiState: { project: S.project, envSel: S.envSel }, apiCookies: S.cookies });
}
addEventListener('beforeunload', () => saveNow());

let projTimer;
function saveProjects(now = false) {
  clearTimeout(projTimer);
  if (now) return LS.save(S.projects);
  projTimer = setTimeout(() => LS.save(S.projects), 300);
}

let toastTimer;
function toast(msg, bad = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = bad ? 'bad' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), bad ? 6000 : 3000);
}

// Live-Schutz wie im Popup: Der erste Klick fragt nach, erst der zweite führt aus.
function guard(live, question, action) {
  return ev => {
    const b = ev.currentTarget;
    const restore = () => {
      if (!b.dataset.armed) return;
      delete b.dataset.armed;
      b.replaceChildren(...b._kids);
    };
    if (!(typeof live === 'function' ? live() : live)) return action(ev);
    if (b.dataset.armed) {
      restore();
      return action(ev);
    }
    b._kids = [...b.childNodes];
    b.dataset.armed = '1';
    b.replaceChildren(typeof question === 'function' ? question() : question);
    setTimeout(restore, 4000);
  };
}

// Zugriff auf eine Adresse erfragen. Muss direkt im Klick passieren (vor jedem await).
// Die Adresse wird gemerkt, damit EnvSwitch den Zugriff nicht wieder abgibt, auch wenn sie in keinem Projekt steht.
function allow(url) {
  const pat = LS.pattern(new URL(url).origin);
  if (!S.apiOrigins.includes(pat)) {
    S.apiOrigins.push(pat);
    chrome.storage.local.set({ apiOrigins: S.apiOrigins });
  }
  return chrome.permissions.request({ origins: [pat] }).catch(() => false);
}

function refreshUrls() {
  document.querySelectorAll('.op.open').forEach(el => el._refreshUrl?.());
}

/* ---------- Kopfzeile: Projekt und Umgebung ---------- */

function renderTop() {
  const sel = $('projectSel');
  sel.hidden = S.projects.length < 2;
  put(sel, S.projects.map(p => h('option', { value: p.id, selected: p.id === S.project }, p.name)));
  const p = project();
  const cur = activeEnv();
  put(
    $('envbar'),
    p?.envs.map((e, i) => h('button', { className: 'pill', 'aria-pressed': String(e === cur), title: e.origin, onclick: () => setEnv(i) }, dot(e.name), e.name, hdot(e)))
  );
  checkHealth(p);
}

/* ---------- 2. Server-Status ---------- */

const HCACHE = new Map(); // origin -> { r, at }
let healthOn = true;
PREFS.get().then(p => {
  healthOn = p.health;
  if (!healthOn) document.querySelectorAll('.hdot').forEach(d => d.remove());
});
function hdot(e) {
  const d = h('span', { className: 'hdot', 'data-h': e.origin });
  const c = HCACHE.get(e.origin);
  d.dataset.state = c?.r?.state ?? 'wait';
  d.title = HEALTH.title(c?.r);
  return d;
}
function checkHealth(p) {
  if (!p || !healthOn) return;
  for (const e of p.envs) {
    const c = HCACHE.get(e.origin);
    if (c && Date.now() - c.at < 60000) continue;
    HCACHE.set(e.origin, { r: c?.r, at: Date.now() });
    HEALTH.check(e, p).then(r => {
      HCACHE.set(e.origin, { r, at: Date.now() });
      document.querySelectorAll(`.hdot[data-h="${CSS.escape(e.origin)}"]`).forEach(d => {
        d.dataset.state = r.state;
        d.title = HEALTH.title(r);
      });
    });
  }
}

$('projectSel').addEventListener('change', () => setProject($('projectSel').value));

function setProject(id) {
  if (!S.projects.some(p => p.id === id)) return;
  S.project = id;
  save();
  renderAll();
}

function setEnv(i) {
  // Eine offene Rückfrage (z. B. „POST auf Prod?“) gilt nach dem Wechsel nicht mehr
  document.querySelectorAll('[data-armed]').forEach(b => {
    delete b.dataset.armed;
    b.replaceChildren(...b._kids);
  });
  S.envSel[S.project] = i;
  save();
  renderTop();
  renderSide();
  refreshUrls();
}

/* ---------- Seitenleiste: Projekt mit Umgebungen ---------- */

function renderSide() {
  const p = project();
  const cur = activeEnv();
  put(
    $('projectBox'),
    p
      ? [
          h('div', { className: 'side-head' }, h('h2', {}, p.name), h('span', { className: 'grow' }), h('button', { className: 'link', onclick: () => editProject(p) }, 'Bearbeiten')),
          h('div', { className: 'envlist' }, p.envs.map((e, i) => envCard(p, e, i, e === cur))),
        ]
      : h('div', { className: 'muted' }, 'Noch kein Projekt. Lege unten eines an, mit deinen Umgebungen wie Lokal, Test und Prod. Es erscheint auch im EnvSwitch-Popup.')
  );
  const noProjects = !S.projects.length;
  $('form').hidden = !(formOpen || editing || noProjects);
  $('showForm').hidden = !$('form').hidden;
  $('cancel').hidden = noProjects && !editing;
  $('addCurrent').hidden = !fromOrigin();
  $('cookies').checked = S.cookies;
}

function fromOrigin() {
  try {
    return S.from && /^https?:/.test(S.from) ? new URL(S.from).origin : null;
  } catch {
    return null;
  }
}

function envCard(p, e, i, active) {
  const key = `${p.id}:${e.name}`;
  const names = Object.keys(AP.parseVars(e.vars));
  const showVars = varsOpen.has(key);
  const vars = h('textarea', { rows: 3, value: e.vars ?? '', spellcheck: false, placeholder: 'token = eyJhbGciOi…\nuserId = 42' });
  vars.addEventListener('input', () => {
    e.vars = vars.value;
    saveProjects();
    refreshUrls();
  });
  return h(
    'div',
    { className: 'env' + (active ? ' active' : '') },
    h('button', { className: 'env-main', title: 'Diese Umgebung verwenden', onclick: () => setEnv(i) }, dot(e.name), h('b', {}, e.name), h('span', { className: 'o' }, e.origin.replace(/^https?:\/\//, ''))),
    names.length > 0 && !showVars && h('div', { className: 'muted vars' }, names.map(n => `{{${n}}}`).join(' ')),
    showVars && h('label', { className: 'f' }, 'Variablen (Name = Wert), nutzbar als {{Name}}', vars),
    h(
      'div',
      { className: 'env-actions' },
      h(
        'button',
        {
          className: 'link' + (showVars ? ' on' : ''),
          onclick: () => {
            if (showVars) varsOpen.delete(key);
            else varsOpen.add(key);
            renderSide();
          },
        },
        showVars ? 'Variablen schliessen' : 'Variablen'
      ),
      h('button', { className: 'link', title: 'Sucht /v3/api-docs, /swagger.json usw. und importiert alle Endpoints', onclick: ev => findDocs(p, i, ev) }, 'API-Doku suchen'),
      h('button', { className: 'link', onclick: guard(LS.isProd(e.name), 'Sicher?', () => chrome.tabs.create({ url: e.origin })) }, 'Öffnen')
    )
  );
}

function editProject(p) {
  editing = p.id;
  $('name').value = p.name;
  $('envs').value = p.envs.map(e => `${e.name} = ${e.origin}`).join('\n');
  $('pages').value = LS.pagesText(p.pages);
  $('formTitle').textContent = 'Projekt bearbeiten';
  $('err').textContent = '';
  renderSide();
  $('name').focus();
}

function resetForm() {
  editing = null;
  $('form').reset();
  $('err').textContent = '';
  $('formTitle').textContent = 'Projekt hinzufügen';
  formOpen = false;
  renderSide();
}

$('showForm').addEventListener('click', () => {
  formOpen = true;
  renderSide();
  $('name').focus();
});
$('cancel').addEventListener('click', resetForm);

$('addCurrent').addEventListener('click', () => {
  const o = fromOrigin();
  const box = $('envs');
  const start = box.value && !box.value.endsWith('\n') ? box.value + '\n' : box.value;
  const name = LS.isLocal(new URL(o).hostname) ? 'Lokal' : 'Name';
  box.value = `${start}${name} = ${o}\n`;
  box.focus();
  box.setSelectionRange(start.length, start.length + name.length);
});

$('form').addEventListener('submit', async ev => {
  ev.preventDefault();
  $('err').textContent = '';
  let envs, pages;
  try {
    envs = LS.parse($('envs').value);
    pages = LS.parsePages($('pages').value, envs);
  } catch (err) {
    $('err').textContent = err.message;
    return;
  }
  // Zugriff gleich im Klick anfragen (für Requests und die Markierung auf der Seite)
  chrome.permissions.request({ origins: [...new Set(envs.map(e => LS.pattern(e.origin)))] }).catch(() => {});
  const name = $('name').value.trim();
  const existing = S.projects.find(p => p.id === editing);
  if (existing) Object.assign(existing, { name, envs: AP.keepVars(existing.envs, envs), pages });
  else {
    const p = { id: Date.now().toString(36), name, envs, pages };
    S.projects.push(p);
    S.project = p.id;
  }
  await saveProjects(true);
  save();
  editing = null;
  formOpen = false;
  $('form').reset();
  $('formTitle').textContent = 'Projekt hinzufügen';
  renderAll();
});

$('cookies').addEventListener('change', () => {
  S.cookies = $('cookies').checked;
  save();
});

/* ---------- Hauptbereich: Sammlungen im Swagger-Stil ---------- */

function renderMain() {
  const q = filter.trim().toLowerCase();
  if (!project()) {
    put($('main'), h('div', { className: 'hero' }, h('h2', {}, 'Zuerst ein Projekt'), h('div', { className: 'muted' }, 'Lege links ein Projekt mit deinen Umgebungen an (oder im EnvSwitch-Popup). Danach reicht im Request ein Pfad wie /api/users, und oben wechselst du zwischen Lokal, Test und Prod.')));
    return;
  }
  const sections = projCols().map(c => colSection(c, q)).filter(Boolean);
  put($('main'), sections.length ? sections : q ? h('div', { className: 'hero' }, h('div', { className: 'muted' }, `Nichts gefunden für „${filter}“.`)) : hero());
}

function hero() {
  return h(
    'div',
    { className: 'hero' },
    h('h2', {}, `Noch keine Requests in ${project().name}`),
    h('div', { className: 'muted' }, 'Lege einen Request an, oder klick links bei einer Umgebung auf „API-Doku suchen“: Bei Spring Boot mit springdoc landen so alle Endpoints automatisch hier.'),
    h('div', { className: 'row' }, h('button', { className: 'ghost', onclick: openImport }, 'Importieren (cURL, Postman, HAR, OpenAPI)'), h('button', { className: 'btn', onclick: () => addReq() }, '+ Request'))
  );
}

function colSection(c, q) {
  const reqs = q ? c.reqs.filter(r => `${r.method} ${r.path} ${r.summary}`.toLowerCase().includes(q)) : c.reqs;
  if (q && !reqs.length) return null;
  const folded = c.folded && !q;
  return h(
    'section',
    { className: 'tag' },
    h(
      'div',
      { className: 'tag-head' },
      h(
        'button',
        {
          className: 'tag-name',
          onclick: () => {
            c.folded = !c.folded;
            save();
            renderMain();
          },
        },
        h('span', { className: 'chev' + (folded ? ' shut' : '') }, '▾'),
        c.name
      ),
      h('span', { className: 'muted' }, `${c.reqs.length} ${c.reqs.length === 1 ? 'Request' : 'Requests'}`),
      h('span', { className: 'grow' }),
      h('button', { className: 'link', onclick: () => addReq(c) }, '+ Request'),
      h('button', { className: 'link', onclick: () => renameCol(c) }, 'Umbenennen'),
      h(
        'button',
        {
          className: 'link',
          onclick: guard(true, 'Wirklich löschen?', () => {
            S.cols = S.cols.filter(x => x !== c);
            save();
            renderMain();
          }),
        },
        'Löschen'
      )
    ),
    !folded && h('div', { className: 'ops' }, reqs.map(r => opBlock(c, r)), !reqs.length && h('div', { className: 'muted empty' }, 'Noch keine Requests in dieser Sammlung.'))
  );
}

function addCol(name) {
  const c = { id: AP.id(), name, projectId: S.project, reqs: [] };
  S.cols.push(c);
  return c;
}

function addReq(c) {
  if (!project()) return toast('Lege zuerst links ein Projekt an.', true);
  c ??= projCols()[0] ?? addCol(T('Meine Requests'));
  const r = AP.newReq();
  c.reqs.push(r);
  c.folded = false;
  opened.add(r.id);
  filter = $('search').value = '';
  save();
  renderMain();
  const el = document.querySelector(`[data-id="${r.id}"]`);
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el?.querySelector('.path-in')?.focus();
}

function renameCol(c) {
  const name = prompt(T('Neuer Name der Sammlung'), c.name)?.trim();
  if (!name) return;
  c.name = name;
  save();
  renderMain();
}

/* ---------- Ein Request (Swagger-Block) ---------- */

function opBlock(c, r) {
  const isOpen = opened.has(r.id);
  const badge = h('span', { className: 'badge' }, r.method);
  const path = h('span', { className: 'path' }, r.path);
  const sum = h('span', { className: 'sum' }, r.summary);
  const star = h('button', { className: 'star' + (r.pin ? ' on' : ''), type: 'button' }, r.pin ? '★' : '☆');
  const paintStar = () => {
    star.className = 'star' + (r.pin ? ' on' : '');
    star.textContent = r.pin ? '★' : '☆';
    star.title = r.pin ? 'Aus dem Popup entfernen' : 'Im Popup anzeigen (schnell senden)';
  };
  paintStar();
  star.addEventListener('click', ev => {
    ev.stopPropagation();
    r.pin = !r.pin;
    paintStar();
    save();
    toast(r.pin ? 'Im Popup verfügbar.' : 'Aus dem Popup entfernt.');
  });
  const block = h(
    'div',
    { className: `op m-${r.method.toLowerCase()}${isOpen ? ' open' : ''}`, 'data-id': r.id },
    h(
      'div',
      {
        className: 'op-head',
        onclick: () => {
          if (opened.has(r.id)) opened.delete(r.id);
          else opened.add(r.id);
          block.replaceWith(opBlock(c, r));
        },
      },
      badge,
      path,
      sum,
      star,
      h('span', { className: 'chev' }, '▾')
    )
  );
  block._sync = () => {
    block.className = `op m-${r.method.toLowerCase()} open`;
    badge.textContent = r.method;
    path.textContent = r.path;
    sum.textContent = r.summary;
  };
  if (isOpen) block.append(opBody(c, r, block));
  return block;
}

function opBody(c, r, block) {
  r.params ??= [];
  r.headers ??= [];
  r.pathVals ??= {};
  r.body ??= { mode: 'json', text: '' };

  const fullUrl = h('div', { className: 'full-url' });
  const refreshUrl = () => {
    try {
      fullUrl.textContent = buildRequest(r, activeEnv()).url.href;
    } catch (err) {
      fullUrl.textContent = err.message;
    }
  };
  block._refreshUrl = refreshUrl;
  const changed = () => {
    block._sync();
    refreshUrl();
    save();
  };

  const method = h('select', { className: 'method', title: 'Methode' }, METHODS.map(m => h('option', { value: m, selected: m === r.method }, m)));
  method.addEventListener('change', () => {
    r.method = method.value;
    changed();
    drawTabs();
  });

  const pathIn = h('input', { className: 'path-in', value: r.path, placeholder: '/api/users/{id}   oder   https://…', spellcheck: false });
  pathIn.addEventListener('input', () => {
    r.path = pathIn.value;
    drawPathVals();
    changed();
  });

  const resBox = h('div', { className: 'res' });
  const sendBtn = h('button', { className: 'btn send' }, 'Senden');
  sendBtn.addEventListener(
    'click',
    guard(
      () => !running.has(r.id) && AP.isProd(activeEnv()?.name ?? '') && !NO_BODY.includes(r.method),
      () => `${r.method} auf ${activeEnv()?.name}?`,
      () => send(r, sendBtn, resBox)
    )
  );

  // Pfad-Parameter wie {id} bekommen eigene Felder
  const pathVals = h('div', { className: 'pathvals' });
  const drawPathVals = () => {
    pathVals.replaceChildren(
      ...AP.pathNames(r.path).flatMap(n => {
        const inp = h('input', { className: 'mono', value: r.pathVals[n] ?? '', placeholder: 'Wert' });
        inp.addEventListener('input', () => {
          r.pathVals[n] = inp.value;
          changed();
        });
        return [h('span', {}, `{${n}}`), inp];
      })
    );
  };
  drawPathVals();

  const summary = h('input', { value: r.summary, placeholder: 'Beschreibung (optional), z. B. Alle Benutzer laden' });
  summary.addEventListener('input', () => {
    r.summary = summary.value;
    changed();
  });

  // Reiter: Parameter, Header, Body
  const tabsBar = h('div', { className: 'tabs', role: 'tablist' });
  const pane = h('div', { className: 'pane' });
  let current = tabOf.get(r.id) ?? (r.body.text.trim() && !NO_BODY.includes(r.method) ? 'body' : 'params');
  const count = rows => rows.filter(x => x.k.trim() && x.on !== false).length;
  const drawTabs = () => {
    const defs = [
      ['params', 'Parameter', count(r.params)],
      ['headers', 'Header', count(r.headers)],
      ['body', 'Body', r.body.text.trim() && r.body.mode !== 'none' && !NO_BODY.includes(r.method) ? '•' : 0],
    ];
    tabsBar.replaceChildren(
      ...defs.map(([k, label, n]) =>
        h('button', { className: 'tab', role: 'tab', 'aria-selected': String(k === current), onclick: () => showTab(k) }, label, n ? h('span', { className: 'n' }, String(n)) : null)
      )
    );
  };
  const showTab = t => {
    current = t;
    tabOf.set(r.id, t);
    drawTabs();
    const onKv = () => {
      drawTabs();
      changed();
    };
    if (t === 'params') pane.replaceChildren(kvTable(r.params, 'Name', 'Wert', onKv));
    else if (t === 'headers') pane.replaceChildren(kvTable(r.headers, 'Header, z. B. Authorization', 'Wert, z. B. Bearer {{token}}', onKv));
    else pane.replaceChildren(bodyEditor(r, () => {
      drawTabs();
      save();
    }));
  };
  showTab(current);

  const moveSel = h('select', { title: 'In andere Sammlung verschieben' }, h('option', { value: '' }, 'Verschieben nach …'), projCols().filter(x => x !== c).map(x => h('option', { value: x.id }, x.name)));
  moveSel.addEventListener('change', () => {
    const to = projCols().find(x => x.id === moveSel.value);
    if (!to) return;
    c.reqs = c.reqs.filter(x => x !== r);
    to.reqs.push(r);
    save();
    renderMain();
    toast(`Nach „${to.name}“ verschoben.`);
  });

  const cmpBox = h('div', { className: 'cmp', hidden: true });
  const actions = h(
    'div',
    { className: 'actions' },
    h(
      'button',
      {
        className: 'link',
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(curl(r, activeEnv()));
            toast('cURL kopiert.');
          } catch (err) {
            toast(err.message, true);
          }
        },
      },
      'Als cURL kopieren'
    ),
    (project()?.envs.length ?? 0) > 1 &&
      h(
        'button',
        {
          className: 'link',
          title: 'Diesen Request an zwei Umgebungen senden und die Antworten vergleichen',
          onclick: () => {
            cmpBox.hidden = !cmpBox.hidden;
            if (!cmpBox.hidden && !cmpBox.childElementCount) cmpBox.append(...compareUi(r));
          },
        },
        '⇆ Umgebungen vergleichen'
      ),
    h(
      'button',
      {
        className: 'link',
        onclick: () => {
          const copy = { ...structuredClone(r), id: AP.id(), summary: r.summary ? `${r.summary} (Kopie)` : '' };
          c.reqs.splice(c.reqs.indexOf(r) + 1, 0, copy);
          opened.add(copy.id);
          save();
          renderMain();
        },
      },
      'Duplizieren'
    ),
    h(
      'button',
      {
        className: 'link',
        onclick: guard(true, 'Wirklich löschen?', () => {
          c.reqs = c.reqs.filter(x => x !== r);
          opened.delete(r.id);
          responses.delete(r.id);
          save();
          renderMain();
        }),
      },
      'Löschen'
    ),
    projCols().length > 1 && moveSel
  );

  const body = h(
    'div',
    { className: 'op-body' },
    h('div', { className: 'urlrow' }, method, pathIn, sendBtn),
    fullUrl,
    pathVals,
    summary,
    tabsBar,
    pane,
    actions,
    cmpBox,
    resBox
  );
  body.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      sendBtn.click();
    }
  });
  refreshUrl();
  if (responses.has(r.id)) showResponse(resBox, responses.get(r.id));
  return body;
}

// Tabelle mit Name/Wert-Zeilen. Unten steht immer eine leere Zeile zum Weiterschreiben.
function kvTable(rows, kph, vph, onChange) {
  const wrap = h('div', { className: 'kv' });
  const ensureTail = () => {
    const last = rows[rows.length - 1];
    if (!last || last.k || last.v) {
      rows.push({ k: '', v: '', on: true });
      return true;
    }
    return false;
  };
  const rowEl = row => {
    const on = h('input', { type: 'checkbox', checked: row.on !== false, title: 'Aktiv' });
    const k = h('input', { value: row.k, placeholder: kph, spellcheck: false });
    const v = h('input', { value: row.v, placeholder: vph, spellcheck: false });
    const x = h('button', { className: 'x', title: 'Zeile entfernen', type: 'button' }, '×');
    const el = h('div', { className: 'kv-row' + (row.on === false ? ' off' : '') }, on, k, v, x);
    const edit = () => {
      x.hidden = false;
      if (ensureTail()) wrap.append(rowEl(rows[rows.length - 1]));
      onChange();
    };
    on.addEventListener('change', () => {
      row.on = on.checked;
      el.classList.toggle('off', !row.on);
      onChange();
    });
    k.addEventListener('input', () => {
      row.k = k.value;
      edit();
    });
    v.addEventListener('input', () => {
      row.v = v.value;
      edit();
    });
    x.hidden = !row.k && !row.v;
    x.addEventListener('click', () => {
      rows.splice(rows.indexOf(row), 1);
      draw();
      onChange();
    });
    return el;
  };
  const draw = () => {
    ensureTail();
    wrap.replaceChildren(...rows.map(rowEl));
  };
  draw();
  return wrap;
}

function bodyEditor(r, onChange) {
  const b = r.body;
  const mode = h(
    'select',
    {},
    [
      ['json', 'JSON'],
      ['text', 'Text'],
      ['form', 'Formular (Name = Wert pro Zeile)'],
      ['none', 'Kein Body'],
    ].map(([v, l]) => h('option', { value: v, selected: v === b.mode }, l))
  );
  const ta = h('textarea', {
    className: 'body',
    rows: 10,
    value: b.text,
    spellcheck: false,
    placeholder: b.mode === 'form' ? 'name = Anna\nort = Bern' : '{\n  "name": "Anna"\n}',
  });
  const hint = h('div', { className: 'bad' });
  const note = h('div', { className: 'muted' }, NO_BODY.includes(r.method) ? `${r.method} schickt keinen Body mit. Für einen Body oben POST, PUT oder PATCH wählen.` : '');
  const check = () => {
    hint.textContent = '';
    if (b.mode !== 'json' || !b.text.trim()) return;
    try {
      // {{variablen}} dürfen auch ohne Anführungszeichen stehen
      JSON.parse(b.text.replace(/\{\{[^}]*\}\}/g, '0'));
    } catch (err) {
      hint.textContent = `Kein gültiges JSON: ${err.message}`;
    }
  };
  const fmt = h('button', { className: 'link', type: 'button' }, 'Formatieren');
  fmt.addEventListener('click', () => {
    try {
      ta.value = b.text = JSON.stringify(JSON.parse(b.text), null, 2);
      check();
      onChange();
    } catch (err) {
      hint.textContent = `Formatieren geht nicht: ${err.message}`;
    }
  });
  mode.addEventListener('change', () => {
    b.mode = mode.value;
    ta.disabled = b.mode === 'none';
    fmt.hidden = b.mode !== 'json';
    check();
    onChange();
  });
  ta.addEventListener('input', () => {
    b.text = ta.value;
    check();
    onChange();
  });
  // Tab-Taste rückt ein statt das Feld zu verlassen
  ta.addEventListener('keydown', ev => {
    if (ev.key !== 'Tab' || ev.shiftKey) return;
    ev.preventDefault();
    ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input'));
  });
  ta.disabled = b.mode === 'none';
  fmt.hidden = b.mode !== 'json';
  check();
  return h('div', { className: 'kv' }, h('div', { className: 'bodybar' }, mode, fmt), ta, hint, note);
}

/* ---------- Anfrage bauen und senden ---------- */

function buildRequest(r, env) {
  return AP.build(r, env, S.cookies);
}

async function send(r, btn, resBox) {
  if (running.has(r.id)) {
    running.get(r.id).abort();
    return;
  }
  let req;
  try {
    req = buildRequest(r, activeEnv());
  } catch (err) {
    showResponse(resBox, { error: err.message });
    return;
  }
  const ok = await allow(req.url);
  if (!ok) {
    showResponse(resBox, { error: `Ohne Zugriff auf ${req.url.host} kann EnvSwitch nichts senden. Beim nächsten Senden im Chrome-Dialog „Zulassen“ wählen.`, sent: req.url.href });
    return;
  }

  const ctrl = new AbortController();
  running.set(r.id, ctrl);
  btn.textContent = 'Abbrechen';
  btn.classList.add('busy');
  resBox.replaceChildren(h('div', { className: 'muted' }, 'Wird gesendet …'));

  const t0 = performance.now();
  let res;
  try {
    const resp = await fetch(req.url, { ...req.init, signal: ctrl.signal });
    const buf = await resp.arrayBuffer();
    const LIMIT = 5e6;
    res = {
      status: resp.status,
      statusText: resp.statusText,
      ms: performance.now() - t0,
      size: buf.byteLength,
      ct: resp.headers.get('content-type') || '',
      headers: [...resp.headers],
      body: new TextDecoder().decode(buf.byteLength > LIMIT ? buf.slice(0, LIMIT) : buf),
      cut: buf.byteLength > LIMIT,
      sent: req.url.href,
      final: resp.redirected ? resp.url : null,
    };
  } catch (err) {
    res = {
      error: err.name === 'AbortError' ? 'Abgebrochen.' : `Keine Antwort (${err.message}). Läuft der Server und stimmt die Adresse?`,
      sent: req.url.href,
    };
  } finally {
    running.delete(r.id);
    btn.textContent = 'Senden';
    btn.classList.remove('busy');
  }
  res.method = r.method;
  res.miss = req.miss;
  responses.set(r.id, res);
  showResponse(resBox, res);
}

function curl(r, env) {
  const { url, init } = buildRequest(r, env);
  const q = s => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const parts = ['curl'];
  if (init.method !== 'GET') parts.push('-X', init.method);
  parts.push(q(url.href));
  for (const [k, v] of init.headers) parts.push('-H', q(`${k}: ${v}`));
  if (init.body != null) parts.push('--data-raw', q(init.body));
  return parts.join(' ');
}

/* ---------- Antwort anzeigen ---------- */

const STATUS = {
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
  415: 'Unsupported Media Type', 422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server Error',
  502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
};

const fmtMs = ms => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`);
const fmtSize = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

function showResponse(box, res) {
  if (res.error) {
    put(box,h('div', { className: 'res-err' }, res.error), res.sent && h('div', { className: 'full-url' }, res.sent));
    return;
  }
  const cls = res.status >= 500 ? 's5' : res.status >= 400 ? 's4' : res.status >= 300 ? 's3' : 's2';
  let parsed;
  if (/json/i.test(res.ct) || /^\s*[[{]/.test(res.body)) {
    try {
      parsed = JSON.parse(res.body);
    } catch {}
  }
  const isHtml = /html/i.test(res.ct);
  const views = [parsed !== undefined && ['tree', 'Baum'], ['raw', 'Roh'], isHtml && ['preview', 'Vorschau'], ['headers', `Header (${res.headers.length})`]].filter(Boolean);
  let view = views[0][0];

  const tabs = h('div', { className: 'tabs' });
  const pane = h('div');
  const draw = () => {
    tabs.replaceChildren(...views.map(([k, l]) => h('button', { className: 'tab', 'aria-selected': String(k === view), onclick: () => ((view = k), draw()) }, l)));
    if (view === 'tree') pane.replaceChildren(h('div', { className: 'out tree' }, jsonTree(parsed)));
    else if (view === 'raw') pane.replaceChildren(h('pre', { className: 'out' }, parsed !== undefined ? JSON.stringify(parsed, null, 2) : res.body || '(leer)'));
    else if (view === 'preview') pane.replaceChildren(h('iframe', { className: 'preview', sandbox: '', srcdoc: res.body, title: 'Vorschau' }));
    else pane.replaceChildren(h('table', { className: 'htable' }, h('tbody', {}, res.headers.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v))))));
  };
  draw();

  const copy = h('button', { className: 'link' }, 'Antwort kopieren');
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(parsed !== undefined ? JSON.stringify(parsed, null, 2) : res.body);
    toast('Antwort kopiert.');
  });

  put(box,
    h('h4', {}, 'Antwort'),
    h(
      'div',
      { className: 'res-meta' },
      h('span', { className: `status ${cls}` }, `${res.status} ${res.statusText || STATUS[res.status] || ''}`.trim()),
      h('span', {}, fmtMs(res.ms)),
      h('span', {}, fmtSize(res.size)),
      res.ct && h('span', { className: 'muted' }, res.ct.split(';')[0]),
      h('span', { className: 'grow' }),
      copy
    ),
    h('div', { className: 'full-url' }, `${res.method} ${res.sent}${res.final ? `  →  ${res.final}` : ''}`),
    res.miss?.length > 0 && h('div', { className: 'warn' }, `Nicht ersetzt (Variable fehlt in dieser Umgebung): ${res.miss.map(n => `{{${n}}}`).join(', ')}`),
    res.cut && h('div', { className: 'warn' }, 'Antwort ist sehr gross, angezeigt werden die ersten 5 MB.'),
    tabs,
    pane
  );
}

// Aufklappbarer JSON-Baum. Tiefe Ebenen werden erst beim Aufklappen gebaut.
function jsonTree(v, key, depth = 0) {
  const label = key === undefined ? [] : [typeof key === 'number' ? h('span', { className: 'j-idx' }, String(key)) : h('span', { className: 'j-key' }, key), ': '];
  if (v && typeof v === 'object') {
    const arr = Array.isArray(v);
    const entries = arr ? v.map((x, i) => [i, x]) : Object.entries(v);
    const n = entries.length;
    const info = arr ? `${n} ${n === 1 ? 'Eintrag' : 'Einträge'}` : `${n} ${n === 1 ? 'Feld' : 'Felder'}`;
    const d = h('details', {}, h('summary', {}, label, arr ? '[' : '{', h('span', { className: 'j-n' }, ` ${info} `), arr ? ']' : '}'));
    let built = false;
    const build = () => {
      if (built) return;
      built = true;
      const MAX = 500;
      d.append(
        h('div', { className: 'j-kids' }, entries.slice(0, MAX).map(([k, x]) => jsonTree(x, k, depth + 1)), n > MAX && h('div', { className: 'j-row j-n' }, `… ${n - MAX} weitere (siehe „Roh“)`))
      );
    };
    d.addEventListener('toggle', () => d.open && build());
    if (depth < 2 && n <= 200) {
      d.open = true;
      build();
    }
    return d;
  }
  const prim =
    typeof v === 'string'
      ? h('span', { className: 'j-str' }, JSON.stringify(v))
      : typeof v === 'number'
        ? h('span', { className: 'j-num' }, String(v))
        : typeof v === 'boolean'
          ? h('span', { className: 'j-bool' }, String(v))
          : h('span', { className: 'j-null' }, 'null');
  return h('div', { className: 'j-row' }, label, prim);
}

/* ---------- OpenAPI / Swagger importieren ---------- */

function openImport() {
  if (!project()) return toast('Lege zuerst links ein Projekt an.', true);
  $('specErr').textContent = '';
  showKind();
  const e = activeEnv();
  if (e && !$('specUrl').value) $('specUrl').placeholder = `${e.origin}/v3/api-docs`;
  $('importDlg').showModal();
}
$('openImport').addEventListener('click', openImport);
$('importCancel').addEventListener('click', () => $('importDlg').close());

const KIND = { curl: 'cURL', postman: 'Postman-Collection', har: 'HAR-Datei', openapi: 'OpenAPI/Swagger', backup: 'EnvSwitch-Backup' };
const showKind = () => {
  const d = AP.detect($('specText').value);
  $('specKind').textContent = $('specText').value.trim() ? (d ? `Erkannt: ${KIND[d.kind]}` : 'Format nicht erkannt') : '';
};
$('specText').addEventListener('input', showKind);
$('pickFile').addEventListener('click', () => $('specFile').click());
const loadFile = async file => {
  if (!file) return;
  $('specText').value = await file.text();
  showKind();
};
$('specFile').addEventListener('change', () => {
  loadFile($('specFile').files[0]);
  $('specFile').value = '';
});
$('specText').addEventListener('dragover', ev => ev.preventDefault());
$('specText').addEventListener('drop', ev => {
  ev.preventDefault();
  loadFile(ev.dataTransfer.files[0]);
});

$('importGo').addEventListener('click', async () => {
  $('specErr').textContent = '';
  let text = $('specText').value.trim();
  const urlIn = $('specUrl').value.trim();
  try {
    let src = null;
    if (!text && urlIn) {
      const url = new URL(/^https?:\/\//i.test(urlIn) ? urlIn : LS.origin(urlIn) + '/' + urlIn.replace(/^[^/]*\/?/, ''));
      if (!(await allow(url))) throw new Error(`Kein Zugriff auf ${url.host} erlaubt.`);
      const resp = await fetch(url, { credentials: S.cookies ? 'include' : 'omit', cache: 'no-store' });
      if (!resp.ok) throw new Error(`${url.href} antwortet mit ${resp.status}.`);
      text = await resp.text();
      src = url.href;
    }
    if (!text) throw new Error('cURL, JSON oder eine Datei einfügen, oder eine Adresse angeben.');
    const d = AP.detect(text);
    if (!d) throw new Error('Format nicht erkannt. Unterstützt: cURL, Postman-Collection (v2), HAR, OpenAPI/Swagger (JSON).');
    if (d.kind === 'openapi') importSpec(d.data, src);
    else if (d.kind === 'backup') throw new Error('Das ist ein Backup. Bitte links über „Backup importieren“ laden.');
    else importReqs(d);
    $('importDlg').close();
    $('specText').value = '';
    $('specUrl').value = '';
    showKind();
  } catch (err) {
    $('specErr').textContent = err.message;
  }
});

// cURL, Postman und HAR ins aktuelle Projekt übernehmen
function importReqs(d) {
  const p = project();
  if (!p) throw new Error('Lege zuerst links ein Projekt an.');
  let groups;
  let replace = null;
  if (d.kind === 'curl') groups = [{ name: 'Importiert', reqs: AP.parseCurls(d.data, p) }];
  else if (d.kind === 'har') groups = [{ name: 'Aus HAR', reqs: AP.parseHar(d.data, p) }];
  else {
    const pm = AP.parsePostman(d.data, p);
    groups = pm.groups;
    replace = `postman:${pm.name}`;
  }
  const total = groups.reduce((n, g) => n + g.reqs.length, 0);
  if (!total) throw new Error(d.kind === 'har' ? 'In der HAR-Datei sind keine API-Aufrufe (Fetch/XHR).' : 'Keine Requests gefunden.');

  // Postman: erneuter Import ersetzt die Sammlungen; cURL/HAR: an gleichnamige Sammlung anhängen
  let at = S.cols.length;
  if (replace) {
    const old = S.cols.filter(c => c.src === replace && c.projectId === p.id);
    if (old.length) at = S.cols.indexOf(old[0]);
    S.cols = S.cols.filter(c => !(c.src === replace && c.projectId === p.id));
  }
  const fresh = [];
  for (const g of groups) {
    const same = !replace && projCols().find(c => c.name === g.name);
    if (same) {
      same.reqs.push(...g.reqs);
      same.folded = false;
    } else fresh.push({ id: AP.id(), name: g.name, projectId: p.id, src: replace ?? undefined, reqs: g.reqs, folded: false });
  }
  S.cols.splice(Math.min(at, S.cols.length), 0, ...fresh);
  if (total === 1) opened.add(groups[0].reqs[0].id), (focusReq = groups[0].reqs[0].id);
  save();
  renderAll();
  toast(`${KIND[d.kind]}: ${total} ${total === 1 ? 'Request' : 'Requests'} importiert.`);
}

function parseSpec(text) {
  let spec;
  try {
    spec = JSON.parse(text);
  } catch {
    throw new Error('Das ist kein JSON. YAML wird noch nicht unterstützt. Bei springdoc liefert /v3/api-docs JSON.');
  }
  if (!spec || !(spec.openapi || spec.swagger) || !spec.paths) throw new Error('Das ist keine OpenAPI/Swagger-Datei („paths“ fehlt).');
  return spec;
}

// Sucht in einer Umgebung die API-Doku (Spring Boot, .NET, FastAPI …) und importiert sie ins Projekt.
async function findDocs(p, i, ev) {
  const btn = ev.currentTarget;
  const e = p.envs[i];
  const okPromise = allow(e.origin);
  const tries = ['/v3/api-docs', '/openapi.json', '/swagger.json', '/v2/api-docs', '/api-docs', '/swagger/v1/swagger.json', '/api/openapi.json', '/api/swagger.json', '/api/v3/api-docs'];
  if (!(await okPromise)) return toast(`Kein Zugriff auf ${new URL(e.origin).host} erlaubt.`, true);
  const old = btn.textContent;
  btn.textContent = 'Suche …';
  try {
    for (const t of tries) {
      try {
        const resp = await fetch(e.origin + t, { credentials: S.cookies ? 'include' : 'omit', cache: 'no-store' });
        if (!resp.ok) continue;
        const spec = JSON.parse(await resp.text());
        if (!(spec?.openapi || spec?.swagger) || !spec.paths) continue;
        S.project = p.id;
        S.envSel[p.id] = i;
        importSpec(spec, e.origin + t);
        return;
      } catch {}
    }
    toast(`Keine API-Doku auf ${e.origin} gefunden. Adresse über „Importieren“ von Hand angeben.`, true);
  } finally {
    btn.textContent = old;
  }
}

function importSpec(spec, src) {
  const title = spec.info?.title || 'API';
  const deref = (s, seen = 0) => {
    if (!s?.$ref || seen > 20 || !s.$ref.startsWith('#/')) return s;
    let x = spec;
    for (const part of s.$ref.slice(2).split('/')) x = x?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
    return deref(x, seen + 1);
  };
  const sample = (s, depth = 0) => {
    s = deref(s);
    if (!s || depth > 6) return null;
    if (s.example !== undefined) return s.example;
    if (s.default !== undefined) return s.default;
    if (s.enum?.length) return s.enum[0];
    if (s.allOf) return Object.assign({}, ...s.allOf.map(x => sample(x, depth + 1)).filter(o => o && typeof o === 'object'));
    if (s.oneOf || s.anyOf) return sample((s.oneOf || s.anyOf)[0], depth + 1);
    const t = Array.isArray(s.type) ? s.type.find(x => x !== 'null') : s.type;
    if (t === 'object' || s.properties) {
      const o = {};
      for (const [k, v] of Object.entries(s.properties ?? {})) o[k] = sample(v, depth + 1);
      return o;
    }
    if (t === 'array') return s.items ? [sample(s.items, depth + 1)] : [];
    if (t === 'integer' || t === 'number') return 0;
    if (t === 'boolean') return false;
    if (t === 'string') return { 'date-time': new Date().toISOString(), date: new Date().toISOString().slice(0, 10), email: 'name@example.ch', uuid: crypto.randomUUID() }[s.format] ?? 'string';
    return null;
  };
  const paramValue = p => {
    const v = p.example ?? p.schema?.example ?? p.default ?? p.schema?.default ?? p.enum?.[0] ?? p.schema?.enum?.[0] ?? '';
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  };

  // Basis-Adresse aus der Doku
  let server = '';
  if (spec.openapi) {
    const s0 = spec.servers?.[0];
    server = (s0?.url ?? '').replace(/\{(\w+)\}/g, (m, n) => s0?.variables?.[n]?.default ?? m);
  } else if (spec.host) server = `${spec.schemes?.[0] ?? 'https'}://${spec.host}${spec.basePath ?? ''}`;
  else server = spec.basePath ?? '';
  let absolute = null;
  try {
    absolute = new URL(server || '/', src ?? undefined);
  } catch {}

  // Passende Umgebung finden (zuerst im aktuellen Projekt), sonst anlegen. Pfade bleiben relativ.
  let p = project();
  let note = '';
  let prefix = '';
  if (absolute) {
    prefix = absolute.pathname.replace(/\/+$/, '');
    const origin = absolute.origin;
    let hit = null;
    for (const pr of [p, ...S.projects.filter(x => x !== p)].filter(Boolean)) {
      const i = pr.envs.findIndex(e => e.origin === origin);
      if (i >= 0) {
        hit = { pr, i };
        break;
      }
    }
    const envName = pr => {
      const local = LS.isLocal(absolute.hostname);
      return local && !pr?.envs.some(e => e.name === 'Lokal') ? 'Lokal' : absolute.host;
    };
    if (hit) {
      p = hit.pr;
      S.project = p.id;
      S.envSel[p.id] = hit.i;
    } else if (p) {
      p.envs.push({ name: envName(p), origin });
      S.envSel[p.id] = p.envs.length - 1;
      note = `, Umgebung „${p.envs.at(-1).name}“ zu ${p.name} hinzugefügt`;
      saveProjects(true);
    } else {
      p = { id: Date.now().toString(36), name: title, envs: [{ name: envName(null), origin }], pages: [] };
      S.projects.push(p);
      S.project = p.id;
      note = `, Projekt „${title}“ angelegt`;
      saveProjects(true);
    }
  } else {
    prefix = server.replace(/\/+$/, '');
    if (!p) throw new Error('Lege zuerst ein Projekt an.');
  }

  // Ein Tag = eine Sammlung, Reihenfolge wie in der Doku
  const groups = new Map();
  for (const t of spec.tags ?? []) groups.set(t.name, []);
  for (const [path, item0] of Object.entries(spec.paths)) {
    const item = deref(item0) ?? {};
    for (const m of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
      const op = item[m];
      if (!op) continue;
      const r = AP.newReq({ method: m.toUpperCase(), path: prefix + path, summary: op.summary || op.operationId || '' });
      for (const p0 of [...(item.parameters ?? []), ...(op.parameters ?? [])]) {
        const pa = deref(p0);
        if (!pa?.name) continue;
        if (pa.in === 'query') r.params.push({ k: pa.name, v: paramValue(pa), on: !!pa.required });
        else if (pa.in === 'header') r.headers.push({ k: pa.name, v: paramValue(pa), on: !!pa.required });
        else if (pa.in === 'path') r.pathVals[pa.name] = paramValue(pa);
        else if (pa.in === 'body') r.body = { mode: 'json', text: JSON.stringify(sample(pa.schema), null, 2) };
      }
      const rb = deref(op.requestBody);
      if (rb?.content) {
        const entries = Object.entries(rb.content);
        const [ct, media] = entries.find(([k]) => /json/i.test(k)) ?? entries[0];
        const ex = media?.example ?? deref(Object.values(media?.examples ?? {})[0])?.value ?? sample(media?.schema);
        if (/form-urlencoded/i.test(ct) && ex && typeof ex === 'object') r.body = { mode: 'form', text: Object.entries(ex).map(([k, v]) => `${k} = ${v ?? ''}`).join('\n') };
        else if (/json/i.test(ct)) r.body = { mode: 'json', text: ex == null ? '' : JSON.stringify(ex, null, 2) };
        else r.body = { mode: 'text', text: ex == null ? '' : typeof ex === 'string' ? ex : JSON.stringify(ex, null, 2) };
      }
      const tag = op.tags?.[0] ?? title;
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push(r);
    }
  }

  // Erneuter Import ersetzt die Sammlungen dieser API im Projekt, statt sie zu verdoppeln
  const mine = c => c.src === title && c.projectId === p.id;
  const before = S.cols.filter(mine);
  const at = before.length ? S.cols.indexOf(before[0]) : S.cols.length;
  S.cols = S.cols.filter(c => !mine(c));
  const fresh = [...groups].filter(([, reqs]) => reqs.length).map(([name, reqs]) => ({ id: AP.id(), name, src: title, projectId: p.id, reqs, folded: false }));
  S.cols.splice(Math.min(at, S.cols.length), 0, ...fresh);

  const total = fresh.reduce((n, c) => n + c.reqs.length, 0);
  save();
  renderAll();
  toast(`${title}: ${total} Endpoints in ${fresh.length} ${fresh.length === 1 ? 'Sammlung' : 'Sammlungen'} ${before.length ? 'aktualisiert' : 'importiert'}${note}.`);
}

/* ---------- Backup (Projekte und Requests) ---------- */

$('exportBtn').addEventListener('click', async () => {
  const { marker } = await chrome.storage.local.get('marker');
  const data = JSON.stringify({ app: 'EnvSwitch', version: 2, projects: S.projects, apiCols: S.cols, marker: marker !== false }, null, 2);
  const a = h('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: `envswitch-backup-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async () => {
  const file = $('importFile').files[0];
  $('importFile').value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    let projects = [];
    let cols = [];
    if (d.app === 'EnvSwitch') {
      projects = d.projects ?? [];
      cols = d.apiCols ?? [];
    } else if (d.app === 'ApiPeek') {
      // Backup der früheren eigenständigen ApiPeek-Extension: Websites werden ein Projekt
      const envs = (d.envs ?? []).map(e => ({ name: e.name, origin: new URL(e.baseUrl).origin, vars: e.vars ?? '' }));
      const base = d.envs?.[0] ? new URL(d.envs[0].baseUrl).pathname.replace(/\/+$/, '') : '';
      const p = { id: Date.now().toString(36), name: 'ApiPeek', envs, pages: [] };
      projects = [p];
      cols = (d.cols ?? []).map(c => ({
        ...c,
        projectId: p.id,
        reqs: c.reqs.map(r => ({ ...r, path: base && !/^https?:/i.test(r.path) && !r.path.startsWith(base) ? base + (r.path.startsWith('/') ? '' : '/') + r.path : r.path })),
      }));
    } else throw new Error('Das ist kein EnvSwitch-Backup.');
    const pIds = new Set(S.projects.map(p => p.id));
    const cIds = new Set(S.cols.map(c => c.id));
    projects = projects.filter(p => !pIds.has(p.id));
    cols = cols.filter(c => !cIds.has(c.id));
    S.projects.push(...projects);
    S.cols.push(...cols);
    if (!project()) S.project = S.projects[0]?.id ?? null;
    await saveProjects(true);
    save();
    renderAll();
    toast(`${projects.length} Projekte und ${cols.length} Sammlungen hinzugefügt.`);
  } catch (err) {
    toast(err.message, true);
  }
});

/* ---------- Start ---------- */

$('newReq').addEventListener('click', () => addReq());
$('newCol').addEventListener('click', () => {
  if (!project()) return toast('Lege zuerst links ein Projekt an.', true);
  const name = prompt(T('Name der Sammlung'), T('Neue Sammlung'))?.trim();
  if (!name) return;
  addCol(name);
  save();
  renderMain();
});
$('search').addEventListener('input', () => {
  filter = $('search').value;
  renderMain();
});

function renderAll() {
  renderTop();
  renderSide();
  renderMain();
  if (focusReq) {
    document.querySelector(`[data-id="${focusReq}"]`)?.scrollIntoView({ block: 'center' });
    focusReq = null;
  }
}

// Änderungen aus dem Popup (Projekte) und vom Icon (aktuelle Seite, gewünschtes Projekt) übernehmen.
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  if (ch.projects && stable(ch.projects.newValue ?? []) !== stable(S.projects)) {
    const typing = document.activeElement?.closest('aside');
    S.projects = ch.projects.newValue ?? [];
    if (!project()) S.project = S.projects[0]?.id ?? null;
    renderTop();
    if (!typing) renderSide();
    renderMain();
  }
  if (ch.apiCols && stable(ch.apiCols.newValue ?? []) !== lastSaved) {
    clearTimeout(saveTimer);
    // Im Popup hinzugefügt: übernehmen (eigene Speicherungen lösen hier nichts aus)
    S.cols = ch.apiCols.newValue ?? [];
    renderMain();
  }
  if (ch.from) {
    S.from = ch.from.newValue ?? null;
    renderSide();
  }
  if (ch.apiOpen?.newValue) {
    pickFromOpen(ch.apiOpen.newValue);
    renderAll();
    afterOpen(ch.apiOpen.newValue);
  }
});

// Vom Popup oder Icon geöffnet: passendes Projekt (und Umgebung der aktuellen Seite) wählen.
let focusReq = null;
// Einmalige Wünsche aus dem Popup (z. B. Import-Dialog öffnen), danach vergessen, damit ein Neuladen sie nicht wiederholt
function afterOpen(o) {
  if (o.import && !$('importDlg').open) openImport();
  chrome.storage.local.remove('apiOpen');
}
function pickFromOpen(o) {
  if (o.projectId && S.projects.some(p => p.id === o.projectId)) S.project = o.projectId;
  if (o.reqId) {
    const c = S.cols.find(c => c.reqs.some(r => r.id === o.reqId));
    if (c) {
      S.project = c.projectId;
      c.folded = false;
      opened.add(o.reqId);
      focusReq = o.reqId;
    }
  }
  const m = o.url ? LS.match(S.projects, o.url) : null;
  if (m && (!o.projectId || m.project.id === o.projectId)) {
    S.project = m.project.id;
    S.envSel[m.project.id] = m.index;
  }
  save();
}

Promise.all([LS.projects(), chrome.storage.local.get(['apiCols', 'apiState', 'apiCookies', 'from', 'apiOpen', 'apiOrigins'])]).then(([projects, d]) => {
  S = {
    projects,
    cols: d.apiCols ?? [],
    project: d.apiState?.project ?? null,
    envSel: d.apiState?.envSel ?? {},
    cookies: d.apiCookies !== false,
    from: d.from ?? null,
    apiOrigins: d.apiOrigins ?? [],
  };
  if (d.apiOpen) pickFromOpen(d.apiOpen);
  if (!project()) S.project = S.projects[0]?.id ?? null;
  renderAll();
  if (d.apiOpen) afterOpen(d.apiOpen);
});

/* ---------- 5. Umgebungen vergleichen (gleicher Request, zwei Umgebungen) ---------- */

function compareUi(r) {
  const p = project();
  const a = activeEnv();
  const others = p.envs.filter(e => e !== a);
  const selA = h('select', {}, p.envs.map((e, i) => h('option', { value: String(i), selected: e === a }, e.name)));
  const selB = h('select', {}, p.envs.map((e, i) => h('option', { value: String(i), selected: e === others[0] }, e.name)));
  const ignore = h('input', { value: r.cmpIgnore ?? '', placeholder: 'Felder ignorieren, z. B. timestamp, id', spellcheck: false });
  ignore.addEventListener('input', () => {
    r.cmpIgnore = ignore.value;
    save();
  });
  const out = h('div', { className: 'cmp-out' });
  const go = h('button', { className: 'btn' }, 'Beide senden');
  go.addEventListener('click', async () => {
    const ea = p.envs[Number(selA.value)];
    const eb = p.envs[Number(selB.value)];
    let qa, qb;
    try {
      qa = buildRequest(r, ea);
      qb = buildRequest(r, eb);
    } catch (err) {
      return put(out, h('div', { className: 'res-err' }, err.message));
    }
    // Zugriff im Klick anfragen
    const pats = [...new Set([qa.url, qb.url].map(u => LS.pattern(u.origin)))];
    for (const pt of pats) if (!S.apiOrigins.includes(pt)) S.apiOrigins.push(pt);
    chrome.storage.local.set({ apiOrigins: S.apiOrigins });
    const ok = await chrome.permissions.request({ origins: pats }).catch(() => false);
    if (!ok) return put(out, h('div', { className: 'res-err' }, 'Ohne Zugriff auf beide Adressen geht der Vergleich nicht.'));
    if ((LS.isProd(ea.name) || LS.isProd(eb.name)) && !NO_BODY.includes(r.method) && !confirm(T(`${r.method} wirklich auch an Live senden?`))) return;
    put(out, h('div', { className: 'muted' }, 'Sende an beide …'));
    const one = async q => {
      const t0 = performance.now();
      try {
        const res = await fetch(q.url, q.init);
        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {}
        return { status: res.status, ms: performance.now() - t0, size: text.length, text, json };
      } catch (err) {
        return { error: err.message };
      }
    };
    const [ra, rb] = await Promise.all([one(qa), one(qb)]);
    showCompare(out, ea, eb, ra, rb, ignore.value.split(',').map(x => x.trim()).filter(Boolean));
  });
  return [h('div', { className: 'cmp-bar' }, selA, h('span', { className: 'muted' }, '⇆'), selB, ignore, go), out];
}

// Unterschiede zweier JSON-Werte als Liste von Pfaden
function jsonDiff(a, b, ignore, path = '', out = []) {
  if (out.length >= 300) return out;
  const ta = Array.isArray(a) ? 'array' : a === null ? 'null' : typeof a;
  const tb = Array.isArray(b) ? 'array' : b === null ? 'null' : typeof b;
  if (ta !== tb) {
    out.push({ path: path || '(Wurzel)', kind: 'changed', a, b });
    return out;
  }
  if (ta === 'object' || ta === 'array') {
    const keys = ta === 'array' ? [...Array(Math.max(a.length, b.length)).keys()] : [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys) {
      if (ignore.includes(String(k))) continue;
      const p = ta === 'array' ? `${path}[${k}]` : path ? `${path}.${k}` : String(k);
      const inA = ta === 'array' ? k < a.length : Object.hasOwn(a, k);
      const inB = ta === 'array' ? k < b.length : Object.hasOwn(b, k);
      if (!inB) out.push({ path: p, kind: 'removed', a: a[k] });
      else if (!inA) out.push({ path: p, kind: 'added', b: b[k] });
      else jsonDiff(a[k], b[k], ignore, p, out);
      if (out.length >= 300) break;
    }
    return out;
  }
  if (a !== b) out.push({ path: path || '(Wurzel)', kind: 'changed', a, b });
  return out;
}

// Zeilen-Unterschiede für Text (einfaches LCS, für grosse Antworten gekürzt)
function lineDiff(x, y) {
  const A = x.split('\n').slice(0, 1500);
  const B = y.split('\n').slice(0, 1500);
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while ((i < n || j < m) && out.length < 300) {
    if (i < n && j < m && A[i] === B[j]) (i++, j++);
    else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) out.push({ kind: 'added', line: j + 1, text: B[j++] });
    else out.push({ kind: 'removed', line: i + 1, text: A[i++] });
  }
  return out;
}

function showCompare(box, ea, eb, ra, rb, ignore) {
  const sideHead = (e, r) =>
    h(
      'div',
      { className: 'cmp-side' },
      dot(e.name),
      h('b', {}, e.name),
      r.error ? h('span', { className: 'bad' }, r.error) : [h('span', { className: `status ${r.status >= 500 ? 's5' : r.status >= 400 ? 's4' : r.status >= 300 ? 's3' : 's2'}` }, String(r.status)), h('span', { className: 'muted' }, `${fmtMs(r.ms)} · ${fmtSize(r.size)}`)]
    );
  const fmt = v => (v === undefined ? '—' : typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v)?.slice(0, 300));
  let body;
  if (ra.error || rb.error) body = h('div', { className: 'muted' }, 'Mindestens eine Umgebung hat nicht geantwortet.');
  else if (ra.json !== undefined && rb.json !== undefined) {
    const d = jsonDiff(ra.json, rb.json, ignore);
    body = !d.length
      ? h('div', { className: 'cmp-same' }, ra.status === rb.status ? '✓ Antworten sind identisch.' : `✓ Inhalt identisch, aber Status unterschiedlich (${ra.status} / ${rb.status}).`)
      : [
          h('div', { className: 'muted' }, `${d.length >= 300 ? '300+' : d.length} Unterschiede${ignore.length ? ` (ignoriert: ${ignore.join(', ')})` : ''}`),
          h(
            'table',
            { className: 'cmp-table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Feld'), h('th', {}, ea.name), h('th', {}, eb.name))),
            h('tbody', {}, d.map(x => h('tr', { className: `d-${x.kind}` }, h('td', {}, x.path), h('td', {}, x.kind === 'added' ? '—' : fmt(x.a)), h('td', {}, x.kind === 'removed' ? '—' : fmt(x.b)))))
          ),
        ];
  } else {
    const d = lineDiff(ra.text, rb.text);
    body = !d.length
      ? h('div', { className: 'cmp-same' }, '✓ Antworten sind identisch.')
      : [
          h('div', { className: 'muted' }, `${d.length >= 300 ? '300+' : d.length} geänderte Zeilen (− nur ${ea.name}, + nur ${eb.name})`),
          h('pre', { className: 'out cmp-lines' }, d.map(x => h('div', { className: `l-${x.kind}` }, `${x.kind === 'added' ? '+' : '−'} ${String(x.line).padStart(4)}  ${x.text}`))),
        ];
  }
  put(box, h('div', { className: 'cmp-heads' }, sideHead(ea, ra), sideHead(eb, rb)), body);
}
