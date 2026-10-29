# EnvSwitch

Chrome-Extension für Projekte mit mehreren Umgebungen (Lokal, Test, Prod):

- **Popup** mit Tabs oben (Switcher, API; weitere Bereiche lassen sich in `TABS` in `popup.js` ergänzen).
- **Switcher:** zwischen Umgebungen wechseln, Seiten wie Backoffice mit einem Klick öffnen, Umgebung auf der Seite markieren (Farbbalken und Tab-Titel). Alt+Shift+E / Alt+Shift+1–3.
- **API-Tester:** Requests senden und Antworten im Swagger-Stil ansehen, mit denselben Projekten und Umgebungen. Öffnen über „API-Tester öffnen“ oder „API“ im Popup.

## API-Tester

- Requests mit Methode, Pfad, Parametern, Headern und Body (JSON, Text, Formular), Pfad-Parameter wie `/api/users/{id}`
- Oben die Umgebung wählen: gleicher Request geht an Lokal, Test oder Prod
- Variablen pro Umgebung, z. B. `{{token}}`, dazu `{{baseUrl}}`, `{{$uuid}}`, `{{$timestamp}}`
- Antwort mit Status, Zeit, Grösse, JSON-Baum, Rohansicht, HTML-Vorschau und Headern
- „API-Doku suchen“ findet `/v3/api-docs` (Spring Boot/springdoc), `/swagger.json` usw. und importiert alle Endpoints; jeder Tag wird eine Sammlung
- Als cURL kopieren, Sammlungen, Suche, Backup als JSON (auch alte ApiPeek-Backups)
- Live-Schutz: POST/PUT/PATCH/DELETE auf Prod/Live braucht einen zweiten Klick
- **Schnell-Requests im Popup:** Request im API-Tester mit ☆ markieren, dann im Popup mit einem Klick senden (Umgebung wählbar, Antwort direkt sichtbar)

Für den API-Tester lässt sich unter `chrome://extensions/shortcuts` ein eigenes Tastenkürzel setzen (Chrome erlaubt nur vier vorgegebene, die braucht der Umgebungswechsel).

## Installieren

`chrome://extensions` → Entwicklermodus → **Entpackte Erweiterung laden** → diesen Ordner wählen.

Alle Daten bleiben in `chrome.storage.local` auf diesem Computer.
