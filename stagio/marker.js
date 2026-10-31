// Markiert Seiten, die zu einem Projekt gehören: Farbbalken oben und Umgebungsname im Tab-Titel.
(() => {
  if (window.top !== window || globalThis.__localhostSwitcherMarker) return;
  globalThis.__localhostSwitcherMarker = true; // nie doppelt laufen
  let bar = null;
  let prefix = '';

  const fixTitle = () => {
    if (prefix && !document.title.startsWith(prefix)) document.title = prefix + document.title;
  };

  async function apply() {
    let data;
    try {
      data = { projects: await LS.projects(), ...(await chrome.storage.local.get(['marker', 'vcsBranch', 'vcs'])) };
    } catch {
      return; // Extension wurde neu geladen
    }
    const m = data.marker !== false ? LS.match(data.projects ?? [], location.href) : null;

    bar?.remove();
    bar = null;
    if (prefix && document.title.startsWith(prefix)) {
      const old = prefix;
      prefix = '';
      document.title = document.title.slice(old.length);
    }
    prefix = '';
    if (!m) return;

    const color = LS.color(m.env.name);
    bar = document.createElement('div');
    bar.id = 'localhost-switcher-marker';
    bar.style.cssText = `all:initial;position:fixed;top:0;left:0;right:0;height:4px;background:${color};z-index:2147483647;pointer-events:none;`;
    const label = document.createElement('div');
    // Auf lokalen Seiten den ausgecheckten Branch dazuschreiben (Branch Manager)
    const branch = data.vcs?.showOnPage !== false && LS.isLocal(location.hostname) ? data.vcsBranch?.[m.project.id]?.branch : null;
    label.textContent = branch ? `${m.env.name.toUpperCase()} · ${branch}` : m.env.name.toUpperCase();
    label.style.cssText = `all:initial;position:absolute;top:0;right:12px;padding:2px 10px 3px;border-radius:0 0 6px 6px;background:${color};color:#fff;font:600 11px/1.3 system-ui,sans-serif;letter-spacing:.03em;`;
    bar.append(label);
    document.documentElement.append(bar);

    prefix = `[${m.env.name}] `;
    fixTitle();
  }

  // Manche Seiten setzen den Titel später neu: dann wieder ergänzen.
  new MutationObserver(fixTitle).observe(document.head || document.documentElement, { childList: true, subtree: true, characterData: true });
  chrome.storage.onChanged.addListener(ch => {
    if (ch.projects || ch.marker || ch.vcsBranch || ch.vcs) apply();
  });
  apply();
})();
