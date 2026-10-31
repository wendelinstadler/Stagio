// Läuft in der Seite selbst und meldet JavaScript-Fehler und console.error an Stagio.
// Verändert nichts an der Seite: console.error funktioniert danach genau wie vorher.
(() => {
  if (window.__stagioErrors) return;
  window.__stagioErrors = true;
  const post = (kind, msg, src) => {
    try {
      window.postMessage({ __stagio: 'log', kind, msg: String(msg).slice(0, 2000), src: src ? String(src).slice(0, 500) : '', t: Date.now() }, '*');
    } catch {}
  };
  const text = x => {
    if (x instanceof Error) return x.message;
    if (typeof x === 'object' && x !== null) {
      try {
        return JSON.stringify(x).slice(0, 500);
      } catch {
        return String(x);
      }
    }
    return String(x);
  };
  addEventListener('error', e => {
    if (e instanceof ErrorEvent) post('js', e.message || (e.error && e.error.message) || 'Unbekannter Fehler', e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '');
  });
  addEventListener('unhandledrejection', e => {
    const r = e.reason;
    post('js', 'Unbehandeltes Promise: ' + text(r), r && r.stack ? String(r.stack).split('\n')[1]?.trim() ?? '' : '');
  });
  const orig = console.error;
  console.error = function (...args) {
    try {
      post('console', args.map(text).join(' '));
    } catch {}
    return orig.apply(this, args);
  };
})();
