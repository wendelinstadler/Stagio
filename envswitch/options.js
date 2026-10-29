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
    box(V.showOnPage, v => ((V.showOnPage = v), save()), 'Branch auf der Seite anzeigen', 'Bei lokalen Umgebungen neben dem Umgebungsnamen, z. B. LOKAL · feature/CHR-123')
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
  const path = h('input', { value: r.path, className: 'mono', placeholder: '~/projects/christ', spellcheck: false });
  name.addEventListener('input', () => ((r.name = name.value), save(true)));
  path.addEventListener('input', () => ((r.path = path.value.trim()), save(true)));
  const check = async () => {
    if (!r.path) return;
    meta.className = 'repo-meta muted';
    meta.textContent = 'Prüfe …';
    try {
      const res = await VCS.call({ op: 'info', path: r.path }, V);
      meta.className = 'repo-meta';
      meta.replaceChildren(h('span', {}, h('span', { className: `vcs ${res.vcs}` }, res.vcs), ' ', h('span', { className: 'ok' }, '✓ '), `Branch ${res.branch}`, res.root !== r.path && h('span', { className: 'muted' }, ` · ${res.root}`)));
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
const preview = () => ($('preview').textContent = VCS.branchName($('template').value || VCS.DEFAULTS.template, 'CHR-123', 'Warenkorb fixen') || '(leer)');
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

const cmd = `node install.js ${chrome.runtime.id}`;
$('cmd').textContent = cmd;
$('extId').textContent = chrome.runtime.id;
$('copyCmd').addEventListener('click', async () => {
  await navigator.clipboard.writeText(cmd);
  $('copyCmd').textContent = 'Kopiert';
  setTimeout(() => ($('copyCmd').textContent = 'Kopieren'), 1500);
});

/* ---------- Start ---------- */

Promise.all([VCS.get(), LS.projects()]).then(([v, p]) => {
  V = v;
  projects = p;
  renderFeats();
  renderRepos();
  renderForm();
  ping();
  if (location.hash === '#repos') document.getElementById('repos').scrollIntoView();
});
