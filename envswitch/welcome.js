const $ = id => document.getElementById(id);

PREFS.get().then(p => ($('lang').value = p.lang ?? 'auto'));
$('lang').addEventListener('change', async () => {
  await PREFS.set({ lang: $('lang').value });
  await I18N.load();
  location.reload();
});

// In Englisch auch das Beispiel anpassen
if (I18N.lang === 'en') $('envs').value = $('envs').value.replace(/^Lokal =/m, 'Local =');

$('form').addEventListener('submit', async ev => {
  ev.preventDefault();
  $('msg').className = 'muted';
  let envs;
  try {
    envs = LS.parse($('envs').value);
  } catch (err) {
    $('msg').className = 'bad';
    $('msg').textContent = err.message;
    return;
  }
  // Zugriff gleich im Klick anfragen (Markierung, Status, Logs)
  const asked = chrome.permissions.request({ origins: [...new Set(envs.map(e => LS.pattern(e.origin)))] }).catch(() => false);
  const projects = await LS.projects();
  projects.push({ id: Date.now().toString(36), name: $('name').value.trim(), envs, pages: [] });
  await LS.save(projects);
  await asked;
  $('msg').className = 'ok';
  $('msg').textContent = '✓ Projekt angelegt. Öffne jetzt deine Seite und klick auf das EnvSwitch-Icon.';
  $('form').reset();
  $('envs').value = '';
});

$('openApi').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'open-api' }));
$('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
