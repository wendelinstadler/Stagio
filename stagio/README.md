# Stagio

Chrome-Extension für Projekte mit mehreren Umgebungen (Lokal, Test, Prod):

- **Popup** mit Tabs oben (Switcher, API, Branches, Logs; weitere Bereiche lassen sich in `TABS` in `popup.js` ergänzen).
- **Switcher:** zwischen Umgebungen wechseln, Seiten wie Backoffice mit einem Klick öffnen, Umgebung auf der Seite markieren (Farbbalken und Tab-Titel). Alt+Shift+E / Alt+Shift+1–3.
- **API-Tester:** Requests senden und Antworten im Swagger-Stil ansehen, mit denselben Projekten und Umgebungen. Öffnen über „API-Tester öffnen“ oder „API“ im Popup.

## API-Tester

- Requests mit Methode, Pfad, Parametern, Headern und Body (JSON, Text, Formular), Pfad-Parameter wie `/api/users/{id}`
- Oben die Umgebung wählen: gleicher Request geht an Lokal, Test oder Prod
- Variablen pro Umgebung, z. B. `{{token}}`, dazu `{{baseUrl}}`, `{{$uuid}}`, `{{$timestamp}}`
- Antwort mit Status, Zeit, Grösse, JSON-Baum, Rohansicht, HTML-Vorschau und Headern
- **Importieren:** cURL (auch mehrere), Postman-Collection, HAR-Datei aus den DevTools und OpenAPI werden automatisch erkannt
- „API-Doku suchen“ findet `/v3/api-docs` (Spring Boot/springdoc), `/swagger.json` usw. und importiert alle Endpoints; jeder Tag wird eine Sammlung
- Als cURL kopieren, Sammlungen, Suche, Backup als JSON (auch alte ApiPeek-Backups)
- Live-Schutz: POST/PUT/PATCH/DELETE auf Prod/Live braucht einen zweiten Klick
- **Request hinzufügen im Popup:** Pfad, Adresse oder cURL einfügen und speichern
- **Schnell-Requests im Popup:** Request im API-Tester mit ☆ markieren, dann im Popup mit einem Klick senden (Umgebung wählbar, Antwort direkt sichtbar)

Für den API-Tester lässt sich unter `chrome://extensions/shortcuts` ein eigenes Tastenkürzel setzen (Chrome erlaubt nur vier vorgegebene, die braucht der Umgebungswechsel).

## Installieren

`chrome://extensions` → Entwicklermodus → **Entpackte Erweiterung laden** → diesen Ordner wählen.

Alle Daten bleiben in `chrome.storage.local` auf diesem Computer.

## Branch Manager (git und Mercurial)

Im Popup unter **Branches**: aktuellen Branch sehen, wechseln (mit Suche), neuen Branch aus Ticket-Nummer erstellen (Vorlage z. B. `feature/{ticket}-{titel}`, auf einer offenen Jira-Seite wird das Ticket übernommen), Status, Pull/Push/Fetch und die letzten Commits. Auf lokalen Seiten steht der Branch neben dem Umgebungsnamen.

Einrichten unter **Einstellungen** (Rechtsklick aufs Icon → Optionen, oder im Branches-Tab unten). Weil Chrome selbst keine Befehle ausführen darf, braucht es einmalig das Hilfsprogramm aus dem Ordner [`helper`](../helper).

## Werkzeuge für Entwickler

- **Header-Presets pro Umgebung:** z. B. `X-Debug: true` oder `Authorization: Bearer {{token}}` werden bei jedem Aufruf dieser Umgebung mitgeschickt (Seiten, Bilder, API). Einstellen unter Einstellungen → Projekte, im Popup mit einem Klick an/aus.
- **Server-Status:** grüner/oranger/roter Punkt pro Umgebung mit Antwortzeit. Prüf-Adresse pro Projekt einstellbar (z. B. `/actuator/health`).
- **Logs:** JS-Fehler, `console.error` und fehlgeschlagene Requests deiner Projektseiten. Die Anzahl steht auf dem Icon, Details im Tab „Logs“ (kopierbar für Bug-Reports).
- **Requests aufnehmen:** im Tab „API“ starten, durch die Seite klicken, stoppen, Auswahl in den API-Tester übernehmen.
- **Umgebungen vergleichen:** gleicher Request an zwei Umgebungen mit Feld-für-Feld-Unterschieden (API-Tester), oder dieselbe Seite nebeneinander (Popup → Vergleichen).
- **Daten löschen:** Cache, Storage, Service Worker und optional Cookies nur genau dieser Adresse. Andere Seiten und Logins bleiben unberührt.

## Neu in 3.0

- **Team-Konfiguration:** Projekt als `.stagio.json` exportieren, ins Repo schreiben oder importieren (Datei/Link). Geheime Werte werden durch Variablen ersetzt; neue Versionen im Repo meldet das Popup.
- **Englisch und Deutsch:** Sprache folgt Chrome, umstellbar unter Einstellungen → Allgemein.
- **Einführung** beim ersten Installieren.
- **Hilfsprogramm per npx:** `npx stagio-helper <ID>`, wird nach `~/.stagio` bzw. `%LOCALAPPDATA%\Stagio` kopiert.
- Store-Unterlagen in `store/`, Datenschutz in `PRIVACY.md`, Build mit `npm run build`.
