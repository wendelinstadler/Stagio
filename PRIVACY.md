# Privacy Policy / Datenschutz

_Last updated: 29 October 2026_

## English

EnvSwitch is a developer tool. It does **not** collect, transmit, sell or share any personal data, and it contains no analytics, tracking or advertising.

**What is stored, and where:** projects, environments, pages, header presets, API requests, settings, recorded requests and collected page errors are stored only in your browser (`chrome.storage.local` / `chrome.storage.session`) on your computer. You can export them yourself as a backup or team file.

**Network requests:** EnvSwitch only sends requests to addresses that you configure or explicitly trigger: opening your environments, server status checks, API requests you send, OpenAPI/Postman/team files you import by link. No data is sent to the developer or any third party.

**Page access:** EnvSwitch asks for access only to the addresses of your own projects (or an address you choose, e.g. to record requests). On those pages it shows the environment marker, collects JavaScript errors and failed requests for the “Logs” tab, applies your header presets and records requests when you start a recording. Nothing of this leaves your computer.

**Helper (optional):** the Branch Manager uses a local helper program that you install yourself. It runs git/hg commands in folders you configure and communicates only with the extension on your computer.

**Deleting data:** removing the extension deletes all stored data. The helper can be removed with `npx github:wendelinstadler/envswitch --uninstall`.

Contact: open an issue at https://github.com/wendelinstadler/envswitch

## Deutsch

EnvSwitch ist ein Werkzeug für Entwickler. Es sammelt, überträgt, verkauft oder teilt **keine** persönlichen Daten und enthält keine Analyse, kein Tracking und keine Werbung.

Alle Daten (Projekte, Umgebungen, Requests, Einstellungen, Aufnahmen, gesammelte Fehler) bleiben in deinem Browser auf deinem Computer. EnvSwitch sendet Anfragen nur an Adressen, die du selbst einrichtest oder auslöst. Zugriff auf Seiten wird nur für die Adressen deiner Projekte angefragt. Das optionale Hilfsprogramm läuft lokal und spricht nur mit der Extension. Beim Entfernen der Extension werden alle Daten gelöscht.
