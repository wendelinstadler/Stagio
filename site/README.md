# Website (stagio.dev)

Statische Seite, ohne Build. Inhalt: `index.html` (Start), `privacy.html` (Datenschutz, Link für den Web Store), `helper.html` (Anleitung Hilfsprogramm). Sprache Deutsch/Englisch per Knopf.

## Veröffentlichen (kostenlos, auch aus privatem Repo)

**Cloudflare Pages** (empfohlen):
1. dash.cloudflare.com → Workers & Pages → Create → Pages → mit GitHub verbinden → Repo wählen.
2. Build command: leer lassen. Output directory: `site`.
3. Unter „Custom domains“ `stagio.dev` hinzufügen.

**Netlify:** app.netlify.com → „Add new site“ → Repo wählen, Publish directory `site`, dann Domain verbinden. Oder den Ordner `site` per Drag & Drop hochladen.

## Anpassen

In `lang.js` oben:
- `store`: Link zum Chrome Web Store, sobald die Extension veröffentlicht ist (bis dahin steht „Bald im Chrome Web Store“).
- `support`: dein Buy-Me-a-Coffee-Link.

Die Kontakt-Adresse `hello@stagio.dev` steht in `index.html` und `privacy.html`.
