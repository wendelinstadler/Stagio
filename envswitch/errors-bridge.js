// Leitet Meldungen aus errors-main.js (Seite) an die Extension weiter.
(() => {
  if (globalThis.__envswitchBridge) return;
  globalThis.__envswitchBridge = true;
  addEventListener('message', e => {
    const d = e.data;
    if (e.source !== window || !d || d.__envswitch !== 'log') return;
    try {
      chrome.runtime.sendMessage({ type: 'log', entry: { kind: d.kind, msg: d.msg, src: d.src, t: d.t } });
    } catch {
      /* Extension wurde neu geladen */
    }
  });
})();
