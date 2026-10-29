# Website (stagio.dev)

Statische Seite ohne Build: `index.html` (Start), `privacy.html` (Datenschutz, Link für den Web Store), `helper.html` (Anleitung Hilfsprogramm). Deutsch/Englisch per Knopf.

## Veröffentlichen mit Netlify (gratis, auch aus privatem Repo)

1. netlify.com mit GitHub anmelden → „Add new site“ → „Import from Git“ → dieses Repo.
2. Build command leer lassen, Publish directory: `site`.
3. „Domain management“ → `stagio.dev` hinzufügen.
4. Bei Namecheap → Domain → „Advanced DNS“:
   - `A`-Record, Host `@`, Wert `75.2.60.5`
   - `CNAME`, Host `www`, Wert `<dein-name>.netlify.app`
5. Nach spätestens einer Stunde läuft die Seite, HTTPS richtet Netlify selbst ein.

## E-Mail

Namecheap → Domain → „Redirect Email“: `hello@stagio.dev` an die eigene Adresse weiterleiten (gratis).

## Anpassen

In `lang.js` oben:
- `store`: Link zum Chrome Web Store, sobald veröffentlicht (bis dahin steht „Bald im Chrome Web Store“).
- `support`: Buy-Me-a-Coffee-Link.
