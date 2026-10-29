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
function saveNow() {
  clearTimeout(saveTimer);
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
    p?.envs.map((e, i) => h('button', { className: 'pill', 'aria-pressed': String(e === cur), title: e.origin, onclick: () => setEnv(i) }, dot(e.name), e.name))
  );
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
    h('div', { className: 'row' }, h('button', { className: 'ghost', onclick: openImport }, 'OpenAPI importieren'), h('button', { className: 'btn', onclick: () => addReq() }, '+ Request'))
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
  c ??= projCols()[0] ?? addCol('Meine Requests');
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
  const name = prompt('Neuer Name der Sammlung', c.name)?.trim();
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
    placeholder: b.mode === 'form' ? 'name = Wendelin\nort = Zürich' : '{\n  "name": "Wendelin"\n}',
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

  const init = { method: r.method, headers, credentials: S.cookies ? 'include' : 'omit', redirect: 'follow', cache: 'no-store' };
  const b = r.body;
  if (!NO_BODY.includes(r.method) && b && b.mode !== 'none' && b.text.trim()) {
    if (b.mode === 'form') {
      init.body = new URLSearchParams(Object.entries(AP.parseVars(sub(b.text)))).toString();
      if (!headers.has('content-type')) headers.set('content-type', 'application/x-www-form-urlencoded');
    } else {
      init.body = sub(b.text);
      if (!headers.has('content-type')) headers.set('content-type', b.mode === 'json' ? 'application/json' : 'text/plain;charset=UTF-8');
    }
  }
  return { url, init, miss: [...miss] };
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
    showResponse(resBox, { error: `Ohne Zugriff auf ${req.url.host} kann ApiPeek nichts senden. Beim nächsten Senden im Chrome-Dialog „Zulassen“ wählen.`, sent: req.url.href });
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
  const e = activeEnv();
  if (e && !$('specUrl').value) $('specUrl').placeholder = `${e.origin}/v3/api-docs`;
  $('importDlg').showModal();
}
$('openImport').addEventListener('click', openImport);
$('importCancel').addEventListener('click', () => $('importDlg').close());

$('importGo').addEventListener('click', async () => {
  $('specErr').textContent = '';
  const text = $('specText').value.trim();
  const urlIn = $('specUrl').value.trim();
  try {
    if (text) {
      importSpec(parseSpec(text), null);
    } else if (urlIn) {
      const url = new URL(/^https?:\/\//i.test(urlIn) ? urlIn : LS.origin(urlIn) + '/' + urlIn.replace(/^[^/]*\/?/, ''));
      if (!(await allow(url))) throw new Error(`Kein Zugriff auf ${url.host} erlaubt.`);
      const resp = await fetch(url, { credentials: S.cookies ? 'include' : 'omit', cache: 'no-store' });
      if (!resp.ok) throw new Error(`${url.href} antwortet mit ${resp.status}.`);
      importSpec(parseSpec(await resp.text()), url.href);
    } else {
      throw new Error('Adresse oder JSON angeben.');
    }
    $('importDlg').close();
    $('specText').value = '';
  } catch (err) {
    $('specErr').textContent = err.message;
  }
});

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
    toast(`Keine API-Doku auf ${e.origin} gefunden. Adresse über „OpenAPI importieren“ von Hand angeben.`, true);
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
  const name = prompt('Name der Sammlung', 'Neue Sammlung')?.trim();
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
}

// Änderungen aus dem Popup (Projekte) und vom Icon (aktuelle Seite, gewünschtes Projekt) übernehmen.
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  if (ch.projects && JSON.stringify(ch.projects.newValue ?? []) !== JSON.stringify(S.projects)) {
    const typing = document.activeElement?.closest('aside');
    S.projects = ch.projects.newValue ?? [];
    if (!project()) S.project = S.projects[0]?.id ?? null;
    renderTop();
    if (!typing) renderSide();
    renderMain();
  }
  if (ch.from) {
    S.from = ch.from.newValue ?? null;
    renderSide();
  }
  if (ch.apiOpen?.newValue) {
    pickFromOpen(ch.apiOpen.newValue);
    renderAll();
  }
});

// Vom Popup oder Icon geöffnet: passendes Projekt (und Umgebung der aktuellen Seite) wählen.
function pickFromOpen(o) {
  if (o.projectId && S.projects.some(p => p.id === o.projectId)) S.project = o.projectId;
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
});
