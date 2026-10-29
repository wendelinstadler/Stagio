// Sprache der Website: Deutsch oder Englisch (gemerkt), Standard nach Browser
(() => {
  let lang;
  try { lang = localStorage.getItem('lang'); } catch {}
  if (lang !== 'de' && lang !== 'en') lang = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
  const set = l => {
    document.documentElement.dataset.lang = l;
    document.documentElement.lang = l;
    try { localStorage.setItem('lang', l); } catch {}
    const b = document.getElementById('langBtn');
    if (b) b.textContent = l === 'de' ? 'English' : 'Deutsch';
  };
  set(lang);
  addEventListener('DOMContentLoaded', () => {
    set(document.documentElement.dataset.lang);
    document.getElementById('langBtn')?.addEventListener('click', () => set(document.documentElement.dataset.lang === 'de' ? 'en' : 'de'));
  });
})();
// Links an einer Stelle
const LINKS = { store: '', support: 'https://buymeacoffee.com/wendelinstadler' };
addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-support]').forEach(a => (a.href = LINKS.support));
  document.querySelectorAll('[data-store]').forEach(a => {
    if (LINKS.store) a.href = LINKS.store;
    else {
      a.removeAttribute('href');
      a.style.opacity = '.6';
      a.style.cursor = 'default';
      a.querySelectorAll('.en').forEach(x => (x.textContent = 'Coming soon to the Chrome Web Store'));
      a.querySelectorAll('.de').forEach(x => (x.textContent = 'Bald im Chrome Web Store'));
    }
  });
});
