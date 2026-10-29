# Chrome Web Store listing

> Name: the name „envSwitch“ is already taken in the Chrome Web Store. Pick a final name before publishing (change `extName` in `envswitch/_locales/*/messages.json`).

**Category:** Developer Tools · **Language:** English (+ German)

## Short description (max. 132 characters)

EN: Switch between local, test and live in one click. API tester, page error logs, header presets and git/hg branches per project.

DE: Mit einem Klick zwischen Lokal, Test und Live wechseln. API-Tester, Fehler-Logs, Header-Presets und git/hg-Branches pro Projekt.

## Detailed description (EN)

EnvSwitch is the toolbox for web developers who work with several environments of the same project.

ENVIRONMENTS
• Open the same page on Local, Test or Live in one click (keeps path and parameters)
• Color bar and environment name on every page, so you never confuse Live with Test
• Open pages like the back office in all environments at once, as tab groups
• Protection for Live: actions on production need a second click
• Server status: green/red dot per environment with response time

API TESTER
• Send requests and read responses like in Swagger: JSON tree, headers, preview
• Import OpenAPI/Swagger (finds /v3/api-docs automatically), cURL, Postman collections and HAR files
• Variables per environment like {{token}}, the same request works on every environment
• Compare environments: send one request to two environments and see every changed field
• Record the API calls of a page and save them as requests
• Star requests to send them right from the popup

DEBUGGING
• Collects JavaScript errors, console.error and failed requests of your pages; the count shows on the icon
• Header presets per environment (e.g. X-Debug: true or an Authorization header), on/off in one click
• Clear cache, storage, service workers and cookies of exactly one environment, nothing else
• View the same page from two environments side by side (desktop, tablet, mobile)

TEAMS
• Share a project as .envswitch.json in your repository; secrets are replaced by variables

BRANCHES (optional)
• git and Mercurial per project: current branch, status, pull/push, switch with search, new branch from a ticket number, recent commits
• Needs a small local helper (one command, macOS/Windows/Linux)

PRIVACY
All data stays on your computer. No analytics, no tracking, no external servers.

## Detaillierte Beschreibung (DE)

EnvSwitch ist der Werkzeugkasten für Webentwickler, die mit mehreren Umgebungen desselben Projekts arbeiten.

UMGEBUNGEN
• Dieselbe Seite mit einem Klick auf Lokal, Test oder Live öffnen (Pfad und Parameter bleiben)
• Farbbalken und Umgebungsname auf jeder Seite, damit du Live nie mit Test verwechselst
• Seiten wie das Backoffice in allen Umgebungen auf einmal öffnen, als Tab-Gruppen
• Schutz für Live: Aktionen auf Produktion brauchen einen zweiten Klick
• Server-Status: grüner/roter Punkt pro Umgebung mit Antwortzeit

API-TESTER
• Requests senden und Antworten lesen wie in Swagger: JSON-Baum, Header, Vorschau
• OpenAPI/Swagger (findet /v3/api-docs selbst), cURL, Postman-Collections und HAR-Dateien importieren
• Variablen pro Umgebung wie {{token}}, derselbe Request funktioniert in jeder Umgebung
• Umgebungen vergleichen: ein Request an zwei Umgebungen, jedes geänderte Feld wird angezeigt
• API-Aufrufe einer Seite aufnehmen und als Requests speichern
• Requests mit Stern direkt im Popup senden

FEHLERSUCHE
• Sammelt JavaScript-Fehler, console.error und fehlgeschlagene Requests; die Anzahl steht auf dem Icon
• Header-Presets pro Umgebung (z. B. X-Debug: true), mit einem Klick an/aus
• Cache, Storage, Service Worker und Cookies genau einer Umgebung löschen, sonst nichts
• Dieselbe Seite aus zwei Umgebungen nebeneinander ansehen

TEAMS
• Projekt als .envswitch.json im Repo teilen; Geheimnisse werden durch Variablen ersetzt

BRANCHES (optional)
• git und Mercurial pro Projekt: aktueller Branch, Status, Pull/Push, wechseln, neuer Branch aus Ticket-Nummer, letzte Commits
• Braucht ein kleines lokales Hilfsprogramm (ein Befehl, macOS/Windows/Linux)

DATENSCHUTZ
Alle Daten bleiben auf deinem Computer. Keine Analyse, kein Tracking, keine fremden Server.

## Single purpose

A developer tool for working with the environments (local, test, production) of web projects: switching between them, testing their APIs and debugging their pages.

## Permission justifications

| Permission | Why |
|---|---|
| `storage` | Saves projects, requests and settings locally. |
| `activeTab` | Reads the URL of the current tab when the user opens the popup, to show its environment and open the same page elsewhere. |
| `tabGroups` | Opens several pages of a project as a named, colored tab group. |
| `scripting` | Shows the environment marker on the user’s own project pages and clears session storage of one environment on request. |
| `nativeMessaging` | Optional Branch Manager: talks to a local helper the user installs to run git/hg. |
| `declarativeNetRequestWithHostAccess` | Adds the user’s header presets to requests of their own environments, and allows frames on the compare page (only in that tab). |
| `webRequest` | Shows failed requests in the “Logs” tab and records API calls when the user starts a recording. Observational only. |
| `browsingData` | “Clear data”: removes cache/storage/service workers of exactly one environment on request. |
| `cookies` | “Clear data”: removes cookies of exactly one host, only when the user ticks it. |
| optional host permissions | Requested per address the user adds to a project (or explicitly records/tests). No access to other sites. |

**Remote code:** none. **Data collection:** none (see PRIVACY.md).

## Assets

- Screenshots 1280×800: `store/screenshot-*.png`
- Small promo tile 440×280: `store/promo-440x280.png`
- Icon 128×128: `envswitch/icons/128.png`
