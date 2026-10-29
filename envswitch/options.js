const $ = id => document.getElementById(id);
let V = null;
let projects = [];

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

let toastTimer;
function toast(msg) {
  $('toast').textContent = msg;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 1800);
}

let saveTimer;
function save(quiet) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await VCS.save(V);
    if (!quiet) toast('Gespeichert');
  }, 300);
}

/* ---------- Funktionen ---------- */

const FEATS = [
  ['branch', 'Aktuellen Branch anzeigen', 'Name des ausgecheckten Branches pro Repo'],
  ['switch', 'Wechseln und erstellen', 'Branch-Liste mit Suche, neuer Branch aus Ticket-Nummer'],
  ['sync', 'Status und Pull/Push', 'Geänderte Dateien, nicht gepushte Commits, Pull und Push per Klick'],
  ['log', 'Letzte Commits', 'Kurzer Verlauf des aktuellen Branches'],
];

function renderFeats() {
  const box = (checked, onchange, title, sub) => {
    const cb = h('input', { type: 'checkbox', checked });
    cb.addEventListener('change', () => onchange(cb.checked));
    return h('label', { className: 'check' }, cb, h('span', {}, title, h('small', {}, sub)));
  };
  $('feats').replaceChildren(
    ...FEATS.map(([k, t, s]) => box(V.features[k], v => ((V.features[k] = v), save()), t, s)),
    box(V.showOnPage, v => ((V.showOnPage = v), save()), 'Branch auf der Seite anzeigen', 'Bei lokalen Umgebungen neben dem Umgebungsnamen, z. B. LOKAL · feature/ABC-123')
  );
}

/* ---------- Repos ---------- */

function renderRepos() {
  if (!projects.length) {
    $('repos').replaceChildren(h('div', { className: 'muted' }, 'Noch kein Projekt. Lege im Popup unter „Switcher“ zuerst ein Projekt an.'));
    return;
  }
  $('repos').replaceChildren(
    h(
      'div',
      { style: 'display:grid;gap:10px' },
      projects.map(p => {
        const list = (V.repos[p.id] ??= []);
        return h(
          'div',
          { className: 'proj', 'data-p': p.id },
          h('b', {}, p.name),
          list.map(r => repoRow(p, r)),
          !list.length && h('div', { className: 'muted' }, 'Noch kein Repo.'),
          h(
            'div',
            {},
            h(
              'button',
              {
                className: 'ghost',
                onclick: () => {
                  list.push({ id: AP.id(), name: list.length ? '' : p.name, path: '' });
                  save(true);
                  renderRepos();
                  const inputs = document.querySelectorAll(`[data-p="${p.id}"] input`);
                  inputs[inputs.length - 1]?.focus();
                },
              },
              '+ Repo hinzufügen'
            )
          )
        );
      })
    )
  );
}

function repoRow(p, r) {
  const meta = h('div', { className: 'repo-meta muted' }, r.path ? '' : 'Ordner angeben und prüfen.');
  const name = h('input', { value: r.name, placeholder: 'Name, z. B. Shop' });
  const path = h('input', { value: r.path, className: 'mono', placeholder: '~/projects/shop', spellcheck: false });
  name.addEventListener('input', () => ((r.name = name.value), save(true)));
  path.addEventListener('input', () => ((r.path = path.value.trim()), save(true)));
  const check = async () => {
    if (!r.path) return;
    meta.className = 'repo-meta muted';
    meta.textContent = 'Prüfe …';
    try {
      const res = await VCS.call({ op: 'info', path: r.path }, V);
      meta.className = 'repo-meta';
      meta.replaceChildren(h('span', {}, h('span', { className: `vcs ${res.vcs}` }, res.vcs), ' ', h('span', { className: 'ok' }, 'OK '), `Branch ${res.branch}`, res.root !== r.path && h('span', { className: 'muted' }, ` · ${res.root}`)));
    } catch (err) {
      meta.className = 'repo-meta bad';
      meta.textContent = err.message;
    }
  };
  path.addEventListener('change', check);
  const row = h(
    'div',
    { className: 'repo' },
    name,
    path,
    h(
      'div',
      { className: 'row' },
      h('button', { className: 'ghost', onclick: check }, 'Prüfen'),
      h(
        'button',
        {
          className: 'link',
          onclick: () => {
            V.repos[p.id] = V.repos[p.id].filter(x => x !== r);
            save();
            renderRepos();
          },
        },
        'Entfernen'
      )
    ),
    meta
  );
  if (r.path) setTimeout(check, 0);
  return row;
}

/* ---------- Vorlage, Erweitert ---------- */

function renderForm() {
  $('template').value = V.template;
  $('hgNew').value = V.hgNew;
  $('gitPull').value = V.gitPull;
  $('binGit').value = V.bins.git;
  $('binHg').value = V.bins.hg;
  $('logCount').value = V.logCount;
  preview();
}
const preview = () => ($('preview').textContent = VCS.branchName($('template').value || VCS.DEFAULTS.template, 'ABC-123', 'Login reparieren') || '(leer)');
$('template').addEventListener('input', () => {
  V.template = $('template').value.trim() || VCS.DEFAULTS.template;
  preview();
  save();
});
$('hgNew').addEventListener('change', () => ((V.hgNew = $('hgNew').value), save()));
$('gitPull').addEventListener('change', () => ((V.gitPull = $('gitPull').value), save()));
$('binGit').addEventListener('input', () => ((V.bins.git = $('binGit').value.trim()), save()));
$('binHg').addEventListener('input', () => ((V.bins.hg = $('binHg').value.trim()), save()));
$('logCount').addEventListener('input', () => ((V.logCount = Math.min(50, Math.max(1, Number($('logCount').value) || 10))), save()));

/* ---------- Hilfsprogramm ---------- */

async function ping() {
  $('hostDot').className = 'dot';
  $('hostText').textContent = 'Prüfe …';
  try {
    const r = await VCS.call({ op: 'ping' }, V);
    $('hostDot').className = 'dot on';
    $('hostText').textContent = `Verbunden (Hilfsprogramm v${r.version}, ${{ darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[r.platform] ?? r.platform}, Node ${r.node})`;
  } catch (err) {
    $('hostDot').className = 'dot off';
    $('hostText').textContent = err.message;
  }
}
$('ping').addEventListener('click', ping);

const cmd = `npx stagio-helper ${chrome.runtime.id}`;
$('cmd').textContent = cmd;
$('cmd2').textContent = `node install.js ${chrome.runtime.id}`;
$('extId').textContent = chrome.runtime.id;
$('copyCmd').addEventListener('click', async () => {
  await navigator.clipboard.writeText(cmd);
  $('copyCmd').textContent = 'Kopiert';
  setTimeout(() => ($('copyCmd').textContent = 'Kopieren'), 1500);
});

/* ---------- Allgemein ---------- */

async function renderGeneral() {
  const p = await PREFS.get();
  const { marker } = await chrome.storage.local.get('marker');
  const box = (checked, onchange, title, sub) => {
    const cb = h('input', { type: 'checkbox', checked });
    cb.addEventListener('change', () => onchange(cb.checked));
    return h('label', { className: 'check' }, cb, h('span', {}, title, h('small', {}, sub)));
  };
  const lang = h('select', { style: 'width:auto' }, [['auto', 'Automatisch'], ['de', 'Deutsch'], ['en', 'English']].map(([v, l]) => h('option', { value: v, selected: (p.lang ?? 'auto') === v }, l)));
  lang.addEventListener('change', async () => {
    await PREFS.set({ lang: lang.value });
    await I18N.load();
    location.reload();
  });
  $('general').replaceChildren(
    h('label', { className: 'check', style: 'align-items:center' }, h('span', {}, 'Sprache'), lang),
    box(p.health, v => PREFS.set({ health: v }).then(() => toast('Gespeichert')), 'Server-Status anzeigen', 'Grüner/roter Punkt pro Umgebung: läuft der Server?'),
    box(p.errors, v => PREFS.set({ errors: v }).then(() => toast('Gespeichert')), 'Fehler auf der Seite sammeln', 'JS-Fehler, console.error und fehlgeschlagene Requests deiner Projektseiten im Tab „Logs“'),
    box(marker !== false, v => chrome.storage.local.set({ marker: v }).then(() => toast('Gespeichert')), 'Umgebung auf der Seite markieren', 'Farbbalken oben und Name im Tab-Titel')
  );
}

/* ---------- Projekte: Header-Presets, Health-Pfad ---------- */

let projTimer;
function saveProjects() {
  clearTimeout(projTimer);
  projTimer = setTimeout(async () => {
    await LS.save(projects);
    toast('Gespeichert');
  }, 400);
}

function renderProjects() {
  if (!projects.length) {
    $('projects').replaceChildren(h('div', { className: 'muted' }, 'Noch kein Projekt. Lege im Popup unter „Switcher“ zuerst ein Projekt an.'));
    return;
  }
  $('projects').replaceChildren(
    h(
      'div',
      { style: 'display:grid;gap:10px' },
      projects.map(p => {
        const health = h('input', { value: p.health ?? '', className: 'mono', placeholder: '/ (Startseite) oder z. B. /actuator/health', spellcheck: false });
        health.addEventListener('input', () => {
          p.health = health.value.trim();
          saveProjects();
        });
        return h(
          'div',
          { className: 'proj' },
          h('b', {}, p.name),
          h('label', { className: 'f' }, 'Prüf-Adresse für den Server-Status', health),
          p.envs.map(e => envHeaders(e))
        );
      })
    )
  );
}

function envHeaders(e) {
  const d = h('span', { className: 'edot' });
  d.style.background = LS.color(e.name);
  const on = h('input', { type: 'checkbox', checked: e.headersOn !== false });
  const ta = h('textarea', { rows: 2, value: e.headers ?? '', spellcheck: false, placeholder: 'X-Debug: true\nAuthorization: Bearer {{token}}' });
  const err = h('div', { className: 'herr' });
  const check = () => {
    try {
      HDR.parse(ta.value);
      err.textContent = '';
      return true;
    } catch (x) {
      err.textContent = x.message;
      return false;
    }
  };
  ta.addEventListener('input', () => {
    e.headers = ta.value;
    if (check()) saveProjects();
  });
  on.addEventListener('change', () => {
    e.headersOn = on.checked;
    saveProjects();
  });
  check();
  return h(
    'div',
    { className: 'envh' },
    h('div', { className: 'who' }, h('b', {}, d, e.name), h('span', {}, e.origin), h('label', { className: 'check', style: 'font-size:12px;margin-top:4px' }, on, h('span', {}, 'Header aktiv'))),
    h('div', {}, ta, err)
  );
}

/* ---------- Team-Konfiguration ---------- */

const repoOf = p => (V?.repos[p.id] ?? []).find(r => r.path);

async function applyTeam(text, from) {
  const { apiCols = [] } = await chrome.storage.local.get('apiCols');
  const fresh = await LS.projects();
  const res = TEAM.apply(text, fresh, apiCols);
  await LS.save(res.projects);
  await chrome.storage.local.set({ apiCols: res.cols });
  projects = res.projects;
  renderProjects();
  renderRepos();
  renderTeam();
  $('teamMsg').className = 'ok';
  $('teamMsg').textContent = `${res.created ? 'Projekt angelegt' : 'Projekt aktualisiert'}: ${res.project.name} (${res.envs} Umgebungen, ${res.reqs} Requests) aus ${from}.`;
}

function teamError(err) {
  $('teamMsg').className = 'bad';
  $('teamMsg').textContent = err.message;
}

$('teamFileBtn').addEventListener('click', () => $('teamFile').click());
$('teamFile').addEventListener('change', async () => {
  const f = $('teamFile').files[0];
  $('teamFile').value = '';
  if (!f) return;
  try {
    await applyTeam(await f.text(), f.name);
  } catch (err) {
    teamError(err);
  }
});
$('teamUrlGo').addEventListener('click', async () => {
  const raw = $('teamUrl').value.trim();
  if (!raw) return;
  try {
    const url = new URL(raw);
    if (!(await chrome.permissions.request({ origins: [LS.pattern(url.origin)] }).catch(() => false))) throw new Error(`Kein Zugriff auf ${url.host} erlaubt.`);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${url.host} antwortet mit ${res.status}.`);
    await applyTeam(await res.text(), url.host);
    $('teamUrl').value = '';
  } catch (err) {
    teamError(err);
  }
});

async function exportTeam(p) {
  // Fester Schlüssel, damit spätere Importe dasselbe Projekt aktualisieren
  if (!p.teamKey) {
    p.teamKey = AP.id() + AP.id();
    await LS.save(projects);
  }
  const { apiCols = [] } = await chrome.storage.local.get('apiCols');
  return TEAM.export(p, apiCols);
}

function renderTeam() {
  $('teamList').replaceChildren(
    ...projects.map(p => {
      const note = h('div', { className: 'muted' }, p.teamAt ? `Zuletzt übernommen: ${new Date(p.teamAt).toLocaleString(I18N.locale)}` : 'Noch nicht geteilt oder importiert.');
      const show = (msg, bad) => {
        note.className = bad ? 'bad' : 'muted';
        note.textContent = msg;
      };
      // Zwei getrennte Zeilen, damit beide übersetzt werden können
      const done = (what, replaced) => {
        note.className = 'muted';
        note.replaceChildren(h('div', {}, what), replaced.length ? h('div', {}, `Geheime Werte ersetzt: ${replaced.join(', ')}. Diese Variablen pro Umgebung setzen.`) : '');
      };
      const repo = repoOf(p);
      return h(
        'div',
        { className: 'proj' },
        h('div', { className: 'row' }, h('b', { className: 'grow' }, p.name),
          h('button', {
            className: 'ghost',
            onclick: async () => {
              const { text, replaced } = await exportTeam(p);
              const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: TEAM.FILE });
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              done(`${TEAM.FILE} heruntergeladen. Ins Hauptverzeichnis des Repos legen und committen.`, replaced);
            },
          }, 'Exportieren'),
          repo && h('button', {
            className: 'ghost',
            title: `${TEAM.FILE} in ${repo.path} schreiben`,
            onclick: async () => {
              try {
                const { text, replaced } = await exportTeam(p);
                const r = await VCS.call({ op: 'writeTeam', path: repo.path, text }, V);
                p.teamHash = TEAM.hash(text);
                p.teamAt = Date.now();
                await LS.save(projects);
                done(`Gespeichert: ${r.written}. Jetzt committen, dann haben es alle.`, replaced);
              } catch (err) {
                show(/Unbekannte Aktion/.test(err.message) ? 'Hilfsprogramm ist veraltet: install-Befehl oben nochmals ausführen.' : err.message, true);
              }
            },
          }, 'Ins Repo schreiben'),
          repo && h('button', {
            className: 'ghost',
            onclick: async () => {
              try {
                const r = await VCS.call({ op: 'readTeam', path: repo.path }, V);
                if (!r.exists) return show(`Im Repo liegt noch keine ${TEAM.FILE}.`, true);
                await applyTeam(r.text, 'dem Repo');
              } catch (err) {
                show(/Unbekannte Aktion/.test(err.message) ? 'Hilfsprogramm ist veraltet: install-Befehl oben nochmals ausführen.' : err.message, true);
              }
            },
          }, 'Aus Repo laden')
        ),
        note
      );
    })
  );
}

/* ---------- Start ---------- */

Promise.all([VCS.get(), LS.projects()]).then(([v, p]) => {
  V = v;
  projects = p;
  renderGeneral();
  renderProjects();
  renderTeam();
  renderFeats();
  renderRepos();
  renderForm();
  ping();
  if (location.hash === '#repos') document.getElementById('repos').scrollIntoView();
});

$('supportBtn').href = LINKS.support;
$('siteLink').href = LINKS.site;
$('privacyLink').href = LINKS.privacy;
