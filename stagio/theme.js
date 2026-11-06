// Hell/Dunkel: 'auto' folgt dem System, 'light' und 'dark' sind fest. Gilt für alle Seiten der Extension.
// Wird im <head> geladen, damit beim Öffnen nichts aufblitzt.
globalThis.THEME = (() => {
  const KEY = 'stagio.theme';
  const apply = t => {
    const r = document.documentElement;
    if (t === 'light' || t === 'dark') r.dataset.theme = t;
    else delete r.dataset.theme;
  };
  const remember = t => {
    try {
      localStorage.setItem(KEY, t);
    } catch {}
  };
  let current = 'auto';
  try {
    current = localStorage.getItem(KEY) || 'auto';
  } catch {}
  apply(current);
  const sync = t => {
    current = t || 'auto';
    apply(current);
    remember(current);
    listeners.forEach(fn => fn(current));
  };
  const listeners = [];
  chrome.storage?.local.get('prefs').then(d => sync(d.prefs?.theme));
  chrome.storage?.onChanged.addListener((c, area) => {
    if (area === 'local' && c.prefs) sync(c.prefs.newValue?.theme);
  });
  return {
    get value() {
      return current;
    },
    // Gerade sichtbares Thema (bei 'auto' das des Systems)
    get effective() {
      return current === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : current;
    },
    async set(t) {
      const { prefs = {} } = await chrome.storage.local.get('prefs');
      await chrome.storage.local.set({ prefs: { ...prefs, theme: t } });
    },
    // Ein Klick wechselt zwischen hell und dunkel (ausgehend vom gerade sichtbaren Thema)
    toggle() {
      return this.set(this.effective === 'dark' ? 'light' : 'dark');
    },
    onChange(fn) {
      listeners.push(fn);
    },
  };
})();
