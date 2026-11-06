// Läuft in der Seite selbst und meldet JavaScript-Fehler und console.error an Stagio.
// Verändert nichts an der Seite: console.error funktioniert danach genau wie vorher.
(() => {
  if (window.__stagioErrors) return;
  window.__stagioErrors = true;
  const cut = (s, n) => (s == null ? '' : String(s).slice(0, n));
  const post = (kind, msg, src, detail) => {
    try {
      window.postMessage({ __stagio: 'log', kind, msg: cut(msg, 2000), src: cut(src, 500), detail, t: Date.now() }, '*');
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
  // Ausführlich für die Detailansicht: Objekte formatiert, Fehler mit Stack
  const full = x => {
    if (x instanceof Error) return x.stack || `${x.name}: ${x.message}`;
    if (typeof x === 'object' && x !== null) {
      try {
        return JSON.stringify(x, null, 2);
      } catch {
        return String(x);
      }
    }
    return String(x);
  };
  addEventListener('error', e => {
    if (!(e instanceof ErrorEvent)) return;
    post('js', e.message || (e.error && e.error.message) || 'Unbekannter Fehler', e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '', {
      stack: cut(e.error && e.error.stack, 6000),
      page: location.href,
    });
  });
  addEventListener('unhandledrejection', e => {
    const r = e.reason;
    post('js', 'Unbehandeltes Promise: ' + text(r), r && r.stack ? String(r.stack).split('\n')[1]?.trim() ?? '' : '', {
      stack: cut(r && r.stack, 6000),
      value: r && r.stack ? '' : cut(full(r), 6000),
      page: location.href,
    });
  });
  const orig = console.error;
  console.error = function (...args) {
    try {
      post('console', args.map(text).join(' '), '', {
        full: cut(args.map(full).join('\n'), 8000),
        stack: cut(new Error().stack?.split('\n').slice(2).join('\n'), 4000),
        page: location.href,
      });
    } catch {}
    return orig.apply(this, args);
  };
})();
