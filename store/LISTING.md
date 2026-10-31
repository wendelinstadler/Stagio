# Chrome Web Store listing

> Name: **Stagio** · Website: https://stagio.dev · Privacy policy URL: https://stagio.dev/privacy.html · Support: https://buymeacoffee.com/wendelinstadler

**Category:** Developer Tools · **Language:** English (+ German)

## Short description (max. 132 characters)

EN: Switch between local, test and live environments. API tester, page error logs, header presets and git/hg branches per project.

DE: Mit einem Klick zwischen Lokal, Test und Live wechseln. API-Tester, Fehler-Logs, Header-Presets und git/hg-Branches pro Projekt.

## Detailed description (EN)

Stagio is for web developers who work on the same site in several environments, for example local, test and production.

Open the current page on another environment with one click. Path and parameters stay the same. Each page gets a colored bar with the environment name, and actions on production need a second click. A dot per environment shows whether its server responds.

The API tester shows requests and responses like Swagger UI. It imports OpenAPI (and finds /v3/api-docs on its own), cURL, Postman collections and HAR files. Variables such as {{token}} are set per environment. One request can be sent to two environments to compare the responses field by field. You can also record the API calls of a page and save them as requests. Starred requests can be sent directly from the popup.

The Logs tab lists JavaScript errors, console.error output and failed requests of your project pages. The number of errors is shown on the toolbar icon.

Other tools: header presets per environment (for example X-Debug or an Authorization header), clearing cache, storage and cookies of a single environment, and viewing the same page from two environments side by side.

Projects can be shared with a team as a .stagio.json file in the repository. Secret values are replaced by variables.

Optional Branch Manager for git and Mercurial: current branch, changed files, pull, push, switching branches, creating a branch from a ticket number and recent commits. It needs a small local helper, installed with one command.

All data stays in your browser. Stagio has no analytics and does not send data to any server.

## Detaillierte Beschreibung (DE)

Stagio ist für Webentwickler, die an derselben Seite in mehreren Umgebungen arbeiten, zum Beispiel Lokal, Test und Produktion.

Die aktuelle Seite lässt sich mit einem Klick in einer anderen Umgebung öffnen, Pfad und Parameter bleiben gleich. Jede Seite bekommt einen farbigen Balken mit dem Namen der Umgebung, Aktionen auf Produktion brauchen einen zweiten Klick. Ein Punkt pro Umgebung zeigt, ob der Server antwortet.

Der API-Tester zeigt Requests und Antworten wie Swagger UI. Er importiert OpenAPI (und findet /v3/api-docs selbst), cURL, Postman-Collections und HAR-Dateien. Variablen wie {{token}} werden pro Umgebung gesetzt. Ein Request lässt sich an zwei Umgebungen senden, um die Antworten Feld für Feld zu vergleichen. Die API-Aufrufe einer Seite können aufgenommen und als Requests gespeichert werden. Markierte Requests lassen sich direkt im Popup senden.

Der Tab Logs listet JavaScript-Fehler, console.error und fehlgeschlagene Requests deiner Projektseiten auf. Die Anzahl steht auf dem Icon.

Weitere Werkzeuge: Header-Presets pro Umgebung (zum Beispiel X-Debug oder ein Authorization-Header), Cache, Storage und Cookies einer einzelnen Umgebung löschen und dieselbe Seite aus zwei Umgebungen nebeneinander ansehen.

Projekte lassen sich als .stagio.json im Repo mit dem Team teilen. Geheime Werte werden durch Variablen ersetzt.

Optionaler Branch Manager für git und Mercurial: aktueller Branch, geänderte Dateien, Pull, Push, Branches wechseln, neuer Branch aus einer Ticket-Nummer und letzte Commits. Er braucht ein kleines lokales Hilfsprogramm, das mit einem Befehl installiert wird.

Alle Daten bleiben in deinem Browser. Stagio hat keine Analyse und sendet keine Daten an Server.

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

**Remote code:** none. **Data collection:** none (see https://stagio.dev/privacy.html).

## Assets

- Screenshots 1280×800: `store/screenshot-*.png`
- Small promo tile 440×280: `store/promo-440x280.png`
- Icon 128×128: `stagio/icons/128.png`
