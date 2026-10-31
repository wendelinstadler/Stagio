// Zeigt dieselbe Seite aus zwei Umgebungen nebeneinander.
// Viele Seiten verbieten die Anzeige in Rahmen (X-Frame-Options, CSP). Nur in diesem Tab und nur für Rahmen
// entfernt eine Sitzungsregel diese beiden Header. Normale Tabs bleiben unverändert.
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const SIZES = [
  ['Desktop', 1280],
  ['Tablet', 820],
  ['Mobil', 390],
];
let size = Number(localStorage.getItem('cmpSize')) || 1280;
let project = null;
let tabId = null;

const ruleId = () => 100000 + (tabId % 1000000);

async function frameRule() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId()],
    addRules: [
      {
        id: ruleId(),
        priority: 2,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'x-frame-options', operation: 'remove' },
            { header: 'content-security-policy', operation: 'remove' },
          ],
        },
        condition: { tabIds: [tabId], resourceTypes: ['sub_frame'] },
      },
    ],
  });
}
addEventListener('pagehide', () => chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId()] }));

const envs = () => project?.envs ?? [];
const pick = sel => envs()[Number(sel.value)] ?? null;

function fill(sel, origin) {
  sel.replaceChildren(...envs().map((e, i) => new Option(e.name, String(i), false, e.origin === origin)));
}

function head(box, e, url) {
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = LS.color(e.name);
  const b = document.createElement('b');
  b.textContent = e.name;
  const u = document.createElement('span');
  u.className = 'u';
  u.textContent = url;
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.textContent = 'Im Tab öffnen ↗';
  box.replaceChildren(dot, b, u, a);
}

function frame(box, url) {
  const f = document.createElement('iframe');
  f.src = url;
  f.title = url;
  box.replaceChildren(f);
  fit(box);
}

// Seite in voller Breite rendern und auf die Spalte verkleinern
function fit(box) {
  const f = box.querySelector('iframe');
  if (!f) return;
  const s = Math.min(1, box.clientWidth / size);
  f.style.width = `${size}px`;
  f.style.height = `${box.clientHeight / s}px`;
  f.style.transform = `scale(${s})`;
}
addEventListener('resize', () => ['frameA', 'frameB'].forEach(id => fit($(id))));

function sizes() {
  $('sizes').replaceChildren(
    ...SIZES.map(([label, w]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.setAttribute('aria-pressed', String(w === size));
      b.onclick = () => {
        size = w;
        try {
          localStorage.setItem('cmpSize', String(w));
        } catch {}
        sizes();
        ['frameA', 'frameB'].forEach(id => fit($(id)));
      };
      return b;
    })
  );
}

async function load() {
  const a = pick($('envA'));
  const b = pick($('envB'));
  if (!a || !b) return;
  let path = $('path').value.trim() || '/';
  if (!path.startsWith('/')) path = '/' + path;
  const origins = [...new Set([a, b].map(e => LS.pattern(e.origin)))];
  const ok = await chrome.permissions.contains({ origins });
  $('perm').hidden = ok;
  $('allow').onclick = async () => {
    if (await chrome.permissions.request({ origins }).catch(() => false)) load();
  };
  history.replaceState(null, '', '?' + new URLSearchParams({ p: project.id, a: a.origin, b: b.origin, path }));
  document.title = `${path} · ${a.name} ⇆ ${b.name}`;
  head($('headA'), a, a.origin + path);
  head($('headB'), b, b.origin + path);
  frame($('frameA'), a.origin + path);
  frame($('frameB'), b.origin + path);
}

$('reload').onclick = load;
$('path').addEventListener('keydown', e => e.key === 'Enter' && load());
$('envA').onchange = load;
$('envB').onchange = load;

(async () => {
  tabId = (await chrome.tabs.getCurrent()).id;
  await frameRule();
  const projects = await LS.projects();
  project = projects.find(p => p.id === q.get('p')) ?? projects[0] ?? null;
  if (!project) {
    document.body.textContent = 'Kein Projekt gefunden.';
    return;
  }
  fill($('envA'), q.get('a') ?? envs()[0]?.origin);
  fill($('envB'), q.get('b') ?? envs()[1]?.origin);
  $('path').value = q.get('path') ?? '/';
  sizes();
  load();
})();
