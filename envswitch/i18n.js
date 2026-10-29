// Sprache: Die Oberfläche ist auf Deutsch geschrieben. Bei Englisch übersetzt I18N alle angezeigten Texte
// (auch später erscheinende) über ein Wörterbuch und Muster mit Platzhaltern {0}, {1} …
// Neue Texte: unten in EN (genauer Text) oder PATTERNS (mit Platzhaltern) ergänzen.
globalThis.I18N = (() => {
  const EN = {
    // ---------- Allgemein ----------
    'Abbrechen': 'Cancel',
    'Speichern': 'Save',
    'Gespeichert': 'Saved',
    'Löschen': 'Delete',
    'Öffnen': 'Open',
    'Öffnen ↗': 'Open ↗',
    'Bearbeiten': 'Edit',
    'Kopieren': 'Copy',
    'Kopiert': 'Copied',
    'Importieren': 'Import',
    'Exportieren': 'Export',
    'Einfügen': 'Paste',
    'Laden': 'Load',
    'Neu laden': 'Reload',
    'Prüfen': 'Check',
    'Entfernen': 'Remove',
    'Erlauben': 'Allow',
    'Übernehmen': 'Apply',
    'Erstellen': 'Create',
    'Wechseln': 'Switch',
    'Senden': 'Send',
    'Sicher?': 'Sure?',
    'Wirklich löschen?': 'Really delete?',
    'Alle': 'All',
    'oder': 'or',
    'Fehler': 'Error',
    'Projekt': 'Project',
    'Sammlung': 'collection',
    'Sammlungen': 'collections',
    'Lade …': 'Loading …',
    'Prüfe …': 'Checking …',
    'Suche …': 'Searching …',
    'gerade eben': 'just now',
    'Erreichbar': 'Reachable',
    'Zeitüberschreitung': 'timeout',
    'nicht erreichbar': 'unreachable',
    'Allgemein': 'General',
    'Erweitert': 'Advanced',
    'Beispiel:': 'Example:',
    'Platzhalter:': 'Placeholders:',
    'Desktop': 'Desktop',
    'Tablet': 'Tablet',
    'Mobil': 'Mobile',
    'Stagio unterstützen': 'Support Stagio',
    'Gefällt dir Stagio?': 'Enjoying Stagio?',
    'Schliessen': 'Close',
    'Stagio ist kostenlos. Mit einem Kaffee hilfst du, dass es weiterentwickelt wird.': 'Stagio is free. A coffee helps keep it developed.',
    'Kaffee spendieren': 'Buy me a coffee',
    'Datenschutz': 'Privacy',
    'Stagio ist kostenlos.': 'Stagio is free.',
    'Unterstützen': 'Support',

    // ---------- Popup: Tabs, Switcher ----------
    'Switcher': 'Switcher',
    'Logs': 'Logs',
    'API-Tester im grossen Fenster öffnen': 'Open API tester in a large window',
    'Projekt hinzufügen': 'Add project',
    'Projekt bearbeiten': 'Edit project',
    'Projektname': 'Project name',
    'Umgebungen (Name = Adresse, Name frei wählbar)': 'Environments (name = address, any name you like)',
    'Lokal = http://localhost:3000 Test = test.example.ch Prod 2 = https://www.example.ch': 'Local = http://localhost:3000\nTest = test.example.ch\nProd 2 = https://www.example.ch',
    'Lokal = http://localhost:8080 Test = test.example.ch Prod = https://www.example.ch': 'Local = http://localhost:8080\nTest = test.example.ch\nProd = https://www.example.ch',
    'Aktuelle Seite als Zeile einfügen': 'Insert current page as a line',
    'Seiten (optional, Name = Pfad)': 'Pages (optional, name = path)',
    'Shop = / Backoffice = /backoffice Admin = /admin': 'Shop = /\nBackoffice = /backoffice\nAdmin = /admin',
    'Shop = / Backoffice = /backoffice': 'Shop = /\nBackoffice = /backoffice',
    'Weicht eine Seite in einer Umgebung ab, eine Zeile mit @ ergänzen:': 'If a page differs in one environment, add a line with @:',
    'Tastenkürzel: Alt+Shift+E schaltet die Umgebung weiter, Alt+Shift+1 bis 3 springt direkt. Auf Live geht es nur per Klick.':
      'Shortcuts: Alt+Shift+E switches to the next environment, Alt+Shift+1 to 3 jumps directly. Live is only reachable by click.',
    'Umgebung auf der Seite markieren (Farbbalken und Tab-Titel)': 'Mark the environment on the page (color bar and tab title)',
    'Alles öffnen': 'Open all',
    'Auch Live öffnen?': 'Open Live too?',
    'Requests für dieses Projekt im API-Tester': 'Requests for this project in the API tester',
    'Markierung auf der Seite ist hier noch nicht erlaubt.': 'Marking the page is not allowed here yet.',
    'Aktuelle Umgebung': 'Current environment',
    'Klick: hier öffnen · Ctrl/Cmd+Klick: neuer Tab': 'Click: open here · Ctrl/Cmd+click: new tab',
    'Auch auf Live öffnen? Nochmals klicken.': 'Open on Live too? Click again.',
    'Diese Seite in allen anderen Umgebungen öffnen': 'Open this page in all other environments',
    'Diese Seite gehört zu keinem Projekt.': 'This page does not belong to any project.',
    'Noch kein Projekt. Lege unten eines an.': 'No project yet. Create one below.',
    'Header aktiv': 'Headers on',
    'Header aus': 'Headers off',
    'Aus + neu laden': 'Off + reload',
    'An + neu laden': 'On + reload',
    '⇆ Vergleichen': '⇆ Compare',
    'Diese Seite in zwei Umgebungen nebeneinander ansehen': 'View this page in two environments side by side',
    'Daten löschen': 'Clear data',
    'Lösche …': 'Clearing …',
    'Nur diese Adresse. Andere Seiten und Logins bleiben unberührt.': 'Only this address. Other sites and logins stay untouched.',
    'Cache': 'Cache',
    'Speicher': 'Storage',
    'Service Worker': 'Service worker',
    'Local/Session Storage und IndexedDB': 'Local/session storage and IndexedDB',
    'Cookies (meldet dich hier ab)': 'Cookies (logs you out here)',
    'Gilt für alle Ports dieses Hosts. Cookies der ganzen Domain bleiben.': 'Applies to all ports of this host. Cookies of the whole domain are kept.',
    'Nur Cookies genau dieses Hosts. Cookies der ganzen Domain bleiben.': 'Only cookies of exactly this host. Cookies of the whole domain are kept.',
    'Löschen und neu laden': 'Clear and reload',
    'nichts': 'nothing',

    // ---------- Popup: API-Tab ----------
    'Schnell-Requests': 'Quick requests',
    'Noch keine Schnell-Requests.': 'No quick requests yet.',
    'Füge unten einen hinzu (Pfad oder cURL einfügen) oder markiere im API-Tester einen mit ☆.': 'Add one below (paste a path or cURL) or star one in the API tester with ☆.',
    'Request hinzufügen': 'Add request',
    '+ Request hinzufügen': '+ Add request',
    '/api/users, Adresse oder cURL einfügen': '/api/users, an address or paste cURL',
    'Name (optional), z. B. Alle Benutzer': 'Name (optional), e.g. All users',
    'Body (optional), z. B. {"name": "Anna"}': 'Body (optional), e.g. {"name": "Anna"}',
    'Mehrere importieren (cURL, Postman, HAR, OpenAPI) ↗': 'Import several (cURL, Postman, HAR, OpenAPI) ↗',
    'Im API-Tester öffnen': 'Open in API tester',
    '… (gekürzt, ganze Antwort im API-Tester)': '… (shortened, full response in the API tester)',
    '(leere Antwort)': '(empty response)',
    'Lege zuerst im Tab „Switcher“ ein Projekt an.': 'Create a project in the “Switcher” tab first.',
    'Lege zuerst im Switcher ein Projekt an.': 'Create a project in the Switcher first.',
    'Pfad oder Adresse angeben, z. B. /api/users': 'Enter a path or address, e.g. /api/users',
    'cURL erkannt.': 'cURL detected.',
    'Zeichnet alle API-Aufrufe (Fetch/XHR) dieses Tabs auf, bis du stoppst': 'Records all API calls (fetch/XHR) of this tab until you stop',
    'Requests dieser Seite aufnehmen': 'Record requests of this page',
    'Stopp': 'Stop',
    'Verwerfen': 'Discard',
    'Klick dich jetzt durch die Seite. Das Popup darf zu sein, die Aufnahme läuft weiter.': 'Now click through the page. The popup may be closed, recording continues.',
    'Keine API-Aufrufe erkannt.': 'No API calls detected.',
    'In den API-Tester übernehmen': 'Add to API tester',
    'Nichts zum Übernehmen.': 'Nothing to add.',
    'Aufnahme läuft': 'Recording',

    // ---------- Popup: Branches ----------
    'Noch kein Repo eingerichtet.': 'No repository set up yet.',
    'Unten auf „Branch Manager einrichten“ klicken und pro Projekt den Ordner angeben.': 'Click “Set up Branch Manager” below and enter the folder for each project.',
    'Branch Manager einrichten': 'Set up Branch Manager',
    'sauber': 'clean',
    'Draft-Commits auf diesem Branch': 'Draft commits on this branch',
    'Push legt den Branch auf origin an': 'Push creates the branch on origin',
    'noch nicht auf Server': 'not on server yet',
    'Neues vom Server holen, ohne zu mergen': 'Get new changes from the server without merging',
    '↓ Pull': '↓ Pull',
    '↑ Push': '↑ Push',
    '+ Neu': '+ New',
    'Commits': 'Commits',
    'Branch suchen …': 'Search branch …',
    'Lade Branches …': 'Loading branches …',
    'Kein Treffer': 'No match',
    'nur Server': 'server only',
    'Bookmark': 'Bookmark',
    'Aktueller Branch': 'Current branch',
    'Ticket, z. B. ABC-123': 'Ticket, e.g. ABC-123',
    'Titel, z. B. Login reparieren': 'Title, e.g. Fix login',
    'als Bookmark': 'as bookmark',
    'als Named Branch': 'as named branch',
    'Lade Commits …': 'Loading commits …',
    'Noch keine Commits.': 'No commits yet.',
    'Gewechselt.': 'Switched.',
    'Branch erstellt.': 'Branch created.',
    'Pull fertig.': 'Pull done.',
    'Push fertig.': 'Push done.',
    'Abgerufen.': 'Fetched.',
    'Pull läuft …': 'Pulling …',
    'Push läuft …': 'Pushing …',
    'Fetch läuft …': 'Fetching …',
    'Wechsle …': 'Switching …',
    'Erstelle …': 'Creating …',
    'Neue Team-Konfiguration im Repo': 'New team configuration in the repository',
    'Team-Konfiguration im Repo gefunden': 'Team configuration found in the repository',

    // ---------- Popup: Logs ----------
    'Konsole': 'Console',
    'Netz': 'Network',
    'JS': 'JS',
    'Leeren': 'Clear',
    'Fehler sammeln ist ausgeschaltet.': 'Error collection is turned off.',
    'In den Einstellungen einschalten': 'Turn it on in the settings',
    'Fehler werden auf den Seiten deiner Projekte gesammelt.': 'Errors are collected on the pages of your projects.',
    'Keine Einträge in diesem Filter.': 'No entries for this filter.',
    'Keine Fehler auf dieser Seite.': 'No errors on this page.',

    // ---------- API-Tester ----------
    'API': 'API',
    'Suchen (Pfad, Methode, Beschreibung)': 'Search (path, method, description)',
    '+ Sammlung': '+ Collection',
    '+ Request': '+ Request',
    '+ Neues Projekt': '+ New project',
    'Projekt': 'Project',
    'Gleiche Projekte wie im Stagio-Popup. Variablen pro Umgebung setzt du nach dem Speichern oben bei der Umgebung.':
      'Same projects as in the Stagio popup. Set variables per environment after saving, at the environment above.',
    'Cookies der Seite mitsenden (eingeloggt bleiben)': 'Send the page’s cookies (stay logged in)',
    'Backup exportieren': 'Export backup',
    'Backup importieren': 'Import backup',
    'Strg+Enter sendet den offenen Request. Ein Tastenkürzel für diese Seite kannst du unter chrome://extensions/shortcuts setzen.':
      'Ctrl+Enter sends the open request. You can set a shortcut for this page at chrome://extensions/shortcuts.',
    'Noch kein Projekt. Lege unten eines an, mit deinen Umgebungen wie Lokal, Test und Prod. Es erscheint auch im Stagio-Popup.':
      'No project yet. Create one below with your environments like Local, Test and Prod. It also appears in the Stagio popup.',
    'Diese Umgebung verwenden': 'Use this environment',
    'Variablen': 'Variables',
    'Variablen schliessen': 'Close variables',
    'Variablen (Name = Wert), nutzbar als {{Name}}': 'Variables (name = value), usable as {{name}}',
    'token = eyJhbGciOi… userId = 42': 'token = eyJhbGciOi…\nuserId = 42',
    'API-Doku suchen': 'Find API docs',
    'Sucht /v3/api-docs, /swagger.json usw. und importiert alle Endpoints': 'Looks for /v3/api-docs, /swagger.json etc. and imports all endpoints',
    'Zuerst ein Projekt': 'Create a project first',
    'Lege links ein Projekt mit deinen Umgebungen an (oder im Stagio-Popup). Danach reicht im Request ein Pfad wie /api/users, und oben wechselst du zwischen Lokal, Test und Prod.':
      'Create a project with your environments on the left (or in the Stagio popup). Then a path like /api/users is enough in a request, and you switch between Local, Test and Prod at the top.',
    'Lege einen Request an, oder klick links bei einer Umgebung auf „API-Doku suchen“: Bei Spring Boot mit springdoc landen so alle Endpoints automatisch hier.':
      'Create a request, or click “Find API docs” at an environment on the left: with Spring Boot and springdoc all endpoints land here automatically.',
    'Importieren (cURL, Postman, HAR, OpenAPI)': 'Import (cURL, Postman, HAR, OpenAPI)',
    'Umbenennen': 'Rename',
    'Noch keine Requests in dieser Sammlung.': 'No requests in this collection yet.',
    'Lege zuerst links ein Projekt an.': 'Create a project on the left first.',
    'Lege zuerst ein Projekt an.': 'Create a project first.',
    'Meine Requests': 'My requests',
    'Neuer Name der Sammlung': 'New collection name',
    'Name der Sammlung': 'Collection name',
    'Neue Sammlung': 'New collection',
    'Aus dem Popup entfernen': 'Remove from popup',
    'Im Popup anzeigen (schnell senden)': 'Show in popup (quick send)',
    'Im Popup verfügbar.': 'Available in the popup.',
    'Aus dem Popup entfernt.': 'Removed from the popup.',
    '/api/users/{id} oder https://…': '/api/users/{id} or https://…',
    'Methode': 'Method',
    'Beschreibung (optional), z. B. Alle Benutzer laden': 'Description (optional), e.g. Load all users',
    'Parameter': 'Parameters',
    'Header': 'Headers',
    'Body': 'Body',
    'Name': 'Name',
    'Wert': 'Value',
    'Aktiv': 'Active',
    'Zeile entfernen': 'Remove row',
    'Header, z. B. Authorization': 'Header, e.g. Authorization',
    'Wert, z. B. Bearer {{token}}': 'Value, e.g. Bearer {{token}}',
    'In andere Sammlung verschieben': 'Move to another collection',
    'Verschieben nach …': 'Move to …',
    'Als cURL kopieren': 'Copy as cURL',
    'cURL kopiert.': 'cURL copied.',
    'Duplizieren': 'Duplicate',
    '⇆ Umgebungen vergleichen': '⇆ Compare environments',
    'Diesen Request an zwei Umgebungen senden und die Antworten vergleichen': 'Send this request to two environments and compare the responses',
    'JSON': 'JSON',
    'Text': 'Text',
    'Formular (Name = Wert pro Zeile)': 'Form (name = value per line)',
    'Kein Body': 'No body',
    'Formatieren': 'Format',
    'Wird gesendet …': 'Sending …',
    'Abgebrochen.': 'Cancelled.',
    'Antwort': 'Response',
    'Antwort kopieren': 'Copy response',
    'Antwort kopiert.': 'Response copied.',
    'Antwort ist sehr gross, angezeigt werden die ersten 5 MB.': 'The response is very large, showing the first 5 MB.',
    'Baum': 'Tree',
    'Roh': 'Raw',
    'Vorschau': 'Preview',
    'Requests importieren': 'Import requests',
    'Wird automatisch erkannt:': 'Detected automatically:',
    '(ein oder mehrere Befehle),': '(one or more commands),',
    '-Datei aus den DevTools und': 'file from DevTools and',
    'curl \'http://localhost:8080/api/users\' -H \'accept: application/json\' … oder Postman-/OpenAPI-JSON hier einfügen bzw. Datei hierher ziehen':
      "curl 'http://localhost:8080/api/users' -H 'accept: application/json'\n\n… or paste Postman/OpenAPI JSON here, or drop a file",
    'Datei wählen (.json, .har)': 'Choose file (.json, .har)',
    '… oder Adresse (OpenAPI- oder Postman-JSON)': '… or address (OpenAPI or Postman JSON)',
    'Wie komme ich an cURL oder HAR?': 'How do I get cURL or HAR?',
    'In Chrome F12 → Netzwerk. Rechtsklick auf einen Request → Kopieren →': 'In Chrome press F12 → Network. Right-click a request → Copy →',
    'Als cURL kopieren (bash)': 'Copy as cURL (bash)',
    ', dann hier einfügen. Für alle auf einmal: Rechtsklick →': ', then paste it here. For all at once: right-click →',
    'Alle als HAR speichern': 'Save all as HAR',
    'und die Datei hier wählen. Übernommen werden nur API-Aufrufe (Fetch/XHR), ohne Bilder, Skripte usw.': 'and choose the file here. Only API calls (fetch/XHR) are imported, no images, scripts etc.',
    'HAR-Datei': 'HAR file',
    'Postman-Collection': 'Postman collection',
    'Stagio-Backup': 'Stagio backup',
    'Format nicht erkannt': 'Format not recognized',
    'Importiert': 'Imported',
    'Aus HAR': 'From HAR',
    'cURL, JSON oder eine Datei einfügen, oder eine Adresse angeben.': 'Paste cURL, JSON or a file, or enter an address.',
    'Format nicht erkannt. Unterstützt: cURL, Postman-Collection (v2), HAR, OpenAPI/Swagger (JSON).': 'Format not recognized. Supported: cURL, Postman collection (v2), HAR, OpenAPI/Swagger (JSON).',
    'Das ist ein Backup. Bitte links über „Backup importieren“ laden.': 'This is a backup. Please load it via “Import backup” on the left.',
    'In der HAR-Datei sind keine API-Aufrufe (Fetch/XHR).': 'The HAR file contains no API calls (fetch/XHR).',
    'Keine Requests gefunden.': 'No requests found.',
    'Das ist kein JSON. YAML wird noch nicht unterstützt. Bei springdoc liefert /v3/api-docs JSON.': 'This is not JSON. YAML is not supported yet. With springdoc, /v3/api-docs returns JSON.',
    'Das ist keine OpenAPI/Swagger-Datei („paths“ fehlt).': 'This is not an OpenAPI/Swagger file (“paths” is missing).',
    'Das ist kein Stagio-Backup.': 'This is not an Stagio backup.',
    'Beide senden': 'Send both',
    'Felder ignorieren, z. B. timestamp, id': 'Ignore fields, e.g. timestamp, id',
    'Sende an beide …': 'Sending to both …',
    'Ohne Zugriff auf beide Adressen geht der Vergleich nicht.': 'Comparing needs access to both addresses.',
    'Mindestens eine Umgebung hat nicht geantwortet.': 'At least one environment did not respond.',
    'Antworten sind identisch.': 'Responses are identical.',
    'Feld': 'Field',

    // ---------- Fehlermeldungen (gemeinsam) ----------
    'Keine Umgebung gewählt: links ein Projekt anlegen und oben eine Umgebung wählen, oder eine volle Adresse mit https:// eingeben.':
      'No environment selected: create a project on the left and pick an environment at the top, or enter a full address with https://.',
    'Mindestens eine Umgebung angeben, eine pro Zeile.': 'Enter at least one environment, one per line.',
    'Kein cURL-Befehl gefunden. Er beginnt mit „curl “.': 'No cURL command found. It starts with “curl ”.',
    'In einem cURL-Befehl fehlt die Adresse.': 'A cURL command is missing the address.',
    'Branch Manager braucht die Berechtigung „nativeMessaging“. Extension neu laden.': 'Branch Manager needs the “nativeMessaging” permission. Reload the extension.',
    'Keine Antwort vom Hilfsprogramm.': 'No answer from the helper.',
    'Hilfsprogramm nicht installiert. Siehe Einstellungen → Hilfsprogramm.': 'Helper not installed. See Settings → Helper.',
    'Das Hilfsprogramm kennt diese Extension nicht. install.js mit der ID aus den Einstellungen nochmals ausführen.': 'The helper does not know this extension. Run the install command from the settings again.',
    'Hilfsprogramm startet nicht (Node verschoben?). install.js nochmals ausführen.': 'The helper does not start (Node moved?). Run the install command again.',
    'Hilfsprogramm ist veraltet: install-Befehl oben nochmals ausführen.': 'The helper is outdated: run the install command above again.',
    'Die Datei ist kein gültiges JSON.': 'The file is not valid JSON.',
    'Das ist keine Stagio-Team-Datei (.stagio.json).': 'This is not an Stagio team file (.stagio.json).',
    'In der Team-Datei fehlen Name oder Umgebungen.': 'The team file is missing a name or environments.',
    'Jede Umgebung braucht name und origin.': 'Each environment needs name and origin.',
    'Kein Projekt gefunden.': 'No project found.',
    // Hilfsprogramm
    'Ungültige Nachricht': 'Invalid message',
    'Kein Ordner angegeben': 'No folder given',
    'kein Upstream': 'no upstream',
    'Named Branch gesetzt. In hg entsteht er mit dem nächsten Commit.': 'Named branch set. In hg it is created with the next commit.',
    'Nichts zu pushen.': 'Nothing to push.',
    'Keine neuen Änderungen.': 'No new changes.',
    'Zu gross': 'Too large',
    'Kein gültiges JSON': 'Not valid JSON',
    'Keine Stagio-Team-Datei': 'Not an Stagio team file',
    '.stagio.json ist grösser als 2 MB': '.stagio.json is larger than 2 MB',

    // ---------- Vergleichsseite ----------
    'Vergleich': 'Compare',
    'Vergleich · Stagio': 'Compare · Stagio',
    'Linke Umgebung': 'Left environment',
    'Rechte Umgebung': 'Right environment',
    'Für den Vergleich braucht Stagio Zugriff auf beide Adressen (damit Seiten im Rahmen angezeigt werden dürfen).': 'For comparing, Stagio needs access to both addresses (so pages may be shown in frames).',
    'Nur zum Ansehen: Klicks in einer Seite gelten nur dort. Bereiche mit Login können hier ausgeloggt erscheinen, weil Chrome Cookies in Rahmen teils sperrt.':
      'For viewing only: clicks in a page only apply there. Areas behind a login may appear logged out here, because Chrome partly blocks cookies in frames.',
    'Im Tab öffnen ↗': 'Open in tab ↗',
    '/pfad?parameter': '/path?parameter',

    // ---------- Einstellungen ----------
    'Stagio Einstellungen': 'Stagio Settings',
    'Sprache': 'Language',
    'Automatisch': 'Automatic',
    'Server-Status anzeigen': 'Show server status',
    'Grüner/roter Punkt pro Umgebung: läuft der Server?': 'Green/red dot per environment: is the server up?',
    'Fehler auf der Seite sammeln': 'Collect errors on the page',
    'JS-Fehler, console.error und fehlgeschlagene Requests deiner Projektseiten im Tab „Logs“': 'JS errors, console.error and failed requests of your project pages in the “Logs” tab',
    'Umgebung auf der Seite markieren': 'Mark the environment on the page',
    'Farbbalken oben und Name im Tab-Titel': 'Color bar at the top and name in the tab title',
    'Projekte: Header-Presets und Server-Status': 'Projects: header presets and server status',
    'Header-Presets werden bei jedem Aufruf dieser Umgebung mitgeschickt (Seiten, Bilder, API-Aufrufe), z. B.': 'Header presets are sent with every request to this environment (pages, images, API calls), e.g.',
    'der Umgebung werden eingesetzt. Eine Zeile': 'of the environment are filled in. A line',
    'ergänzt ein Cookie.': 'adds a cookie.',
    'Noch kein Projekt. Lege im Popup unter „Switcher“ zuerst ein Projekt an.': 'No project yet. First create a project in the popup under “Switcher”.',
    'Prüf-Adresse für den Server-Status': 'Check address for the server status',
    '/ (Startseite) oder z. B. /actuator/health': '/ (home page) or e.g. /actuator/health',
    'X-Debug: true Authorization: Bearer {{token}}': 'X-Debug: true\nAuthorization: Bearer {{token}}',
    'Team-Konfiguration teilen': 'Share team configuration',
    'Ein Projekt als': 'Export a project as',
    'exportieren und ins Projekt-Repo legen. Kolleginnen und Kollegen importieren die Datei und haben dieselben Umgebungen, Seiten, Header-Presets und Requests. Variablen (Tokens) bleiben lokal, geheime Header-Werte werden durch':
      'and put it into the project repository. Colleagues import the file and get the same environments, pages, header presets and requests. Variables (tokens) stay local, secret header values are replaced by',
    'ersetzt. Ist der Branch Manager eingerichtet, meldet das Popup neue Versionen aus dem Repo.': '. If Branch Manager is set up, the popup reports new versions from the repository.',
    'Team-Datei importieren …': 'Import team file …',
    '… oder Link, z. B. https://raw.githubusercontent.com/…/.stagio.json': '… or link, e.g. https://raw.githubusercontent.com/…/.stagio.json',
    'Noch nicht geteilt oder importiert.': 'Not shared or imported yet.',
    'Projekt angelegt': 'Project created',
    'Projekt aktualisiert': 'Project updated',
    'dem Repo': 'the repository',
    'Ins Repo schreiben': 'Write to repository',
    'Aus Repo laden': 'Load from repository',
    'Branch Manager': 'Branch Manager',
    '1. Hilfsprogramm einrichten': '1. Set up the helper',
    'Chrome darf selbst keine git- oder hg-Befehle ausführen. Das erledigt ein kleines Hilfsprogramm, das du einmal einrichtest. Es kann nur die Aktionen des Branch Managers ausführen, sonst nichts.':
      'Chrome itself may not run git or hg commands. A small helper you set up once does that. It can only run the Branch Manager actions, nothing else.',
    'Noch nicht geprüft': 'Not checked yet',
    'Verbindung prüfen': 'Check connection',
    'muss installiert sein (': 'must be installed (',
    'im Terminal zeigt eine Version).': 'in a terminal shows a version).',
    'Im Terminal ausführen:': 'Run in a terminal:',
    'Ohne npx (im Ordner helper des Repos):': 'Without npx (in the repository’s helper folder):',
    'Auf einem zweiten Computer dort ebenfalls ausführen, jeweils mit der ID aus diesen Einstellungen.': 'On a second computer, run it there as well, each time with the ID from these settings.',
    'Auf': 'Click',
    'klicken. Klappt es nicht, Chrome einmal ganz schliessen und neu öffnen.': '. If it does not work, quit Chrome completely once and reopen it.',
    'Diese Extension-ID:': 'This extension ID:',
    '2. Funktionen': '2. Features',
    'Wähle aus, was im Popup im Tab „Branches“ erscheinen soll.': 'Choose what appears in the popup’s “Branches” tab.',
    'Aktuellen Branch anzeigen': 'Show current branch',
    'Name des ausgecheckten Branches pro Repo': 'Name of the checked-out branch per repository',
    'Wechseln und erstellen': 'Switch and create',
    'Branch-Liste mit Suche, neuer Branch aus Ticket-Nummer': 'Branch list with search, new branch from a ticket number',
    'Status und Pull/Push': 'Status and pull/push',
    'Geänderte Dateien, nicht gepushte Commits, Pull und Push per Klick': 'Changed files, unpushed commits, pull and push in one click',
    'Letzte Commits': 'Recent commits',
    'Kurzer Verlauf des aktuellen Branches': 'Short history of the current branch',
    'Branch auf der Seite anzeigen': 'Show branch on the page',
    'Bei lokalen Umgebungen neben dem Umgebungsnamen, z. B. LOKAL · feature/ABC-123': 'On local environments next to the environment name, e.g. LOCAL · feature/ABC-123',
    '3. Repos pro Projekt': '3. Repositories per project',
    'Den Ordner angeben, in dem das Projekt auf deinem Computer liegt, z. B.': 'Enter the folder where the project is on your computer, e.g.',
    '. git oder hg wird automatisch erkannt.': '. git or hg is detected automatically.',
    'Noch kein Repo.': 'No repository yet.',
    '+ Repo hinzufügen': '+ Add repository',
    'Name, z. B. Shop': 'Name, e.g. Shop',
    'Ordner angeben und prüfen.': 'Enter the folder and check it.',
    'Neue Branches': 'New branches',
    'Vorlage für den Namen': 'Name template',
    '(z. B. ABC-123) und': '(e.g. ABC-123) and',
    'Mercurial: neuer Branch als': 'Mercurial: new branch as',
    'Named Branch (hg branch)': 'Named branch (hg branch)',
    'Bookmark (hg bookmark)': 'Bookmark (hg bookmark)',
    'Git: Pull-Verhalten': 'Git: pull behavior',
    'Nur Fast-Forward (sicher)': 'Fast-forward only (safe)',
    'Rebase': 'Rebase',
    'Merge': 'Merge',
    'Pfad zu git (leer = automatisch)': 'Path to git (empty = automatic)',
    'Pfad zu hg (leer = automatisch)': 'Path to hg (empty = automatic)',
    'Anzahl letzte Commits': 'Number of recent commits',
    'Login reparieren': 'Fix login',

    // ---------- Einführung ----------
    'Willkommen bei Stagio': 'Welcome to Stagio',
    'Wechsle mit einem Klick zwischen Lokal, Test und Live, teste APIs und sieh die Fehler deiner Seiten.': 'Switch between local, test and live in one click, test APIs and see your pages’ errors.',
    'Deutsch': 'Deutsch',
    'Icon anheften': 'Pin the icon',
    'Klick oben rechts in Chrome auf das Puzzle-Symbol und hefte Stagio an. So ist das Popup immer einen Klick entfernt.': 'Click the puzzle icon at the top right of Chrome and pin Stagio. That way the popup is always one click away.',
    'Erstes Projekt anlegen': 'Create your first project',
    'Ein Projekt ist eine Website mit ihren Umgebungen. Eine Zeile pro Umgebung, der Name ist frei wählbar.': 'A project is a website with its environments. One line per environment, any name you like.',
    'z. B. Mein Shop': 'e.g. My shop',
    'Umgebungen (Name = Adresse)': 'Environments (name = address)',
    'Projekt anlegen': 'Create project',
    'Projekt angelegt. Öffne jetzt deine Seite und klick auf das Stagio-Icon.': 'Project created. Now open your page and click the Stagio icon.',
    'Loslegen': 'Get started',
    'Gleiche Seite in einer anderen Umgebung öffnen, Seiten wie das Backoffice mit einem Klick.': 'Open the same page in another environment, pages like the back office in one click.',
    'API-Tester': 'API tester',
    'Requests senden wie in Swagger, OpenAPI, cURL, Postman und HAR importieren.': 'Send requests like in Swagger, import OpenAPI, cURL, Postman and HAR.',
    'JS-Fehler und fehlgeschlagene Requests deiner Seiten, die Anzahl steht auf dem Icon.': 'JS errors and failed requests of your pages, the count shows on the icon.',
    'git und Mercurial pro Projekt. Optional, braucht ein kleines Hilfsprogramm.': 'git and Mercurial per project. Optional, needs a small helper.',
    'API-Tester öffnen': 'Open API tester',
    'Einstellungen': 'Settings',
    'Alle Daten bleiben auf deinem Computer. Stagio sendet nichts an andere Server.': 'All data stays on your computer. Stagio sends nothing to other servers.',
    'Felder': 'fields',
    'Einträge': 'items',
    'Eintrag': 'item',
    'Unbekannter Fehler': 'Unknown error',
  };

  // Texte mit Platzhaltern. Gefundene Werte werden ihrerseits übersetzt.
  const PATTERNS = [
    ['Nichts gefunden für „{0}“.', 'Nothing found for “{0}”.'],
    ['Noch keine Requests in {0}', 'No requests in {0} yet'],
    ['{0} auf {1}?', '{0} on {1}?'],
    ['{0} auf {1}? Nochmals klicken.', '{0} on {1}? Click again.'],
    ['Auf {0}? Nochmals klicken.', 'On {0}? Click again.'],
    ['{0} schickt keinen Body mit. Für einen Body oben POST, PUT oder PATCH wählen.', '{0} sends no body. Choose POST, PUT or PATCH above for a body.'],
    ['Kein gültiges JSON: {0}', 'Not valid JSON: {0}'],
    ['Formatieren geht nicht: {0}', 'Cannot format: {0}'],
    ['Ohne Zugriff auf {0} kann Stagio nichts senden. Beim nächsten Senden im Chrome-Dialog „Zulassen“ wählen.', 'Without access to {0} Stagio cannot send anything. Choose “Allow” in the Chrome dialog next time you send.'],
    ['Keine Antwort ({0}). Läuft der Server und stimmt die Adresse?', 'No response ({0}). Is the server running and is the address right?'],
    ['Keine Antwort ({0}). Läuft der Server?', 'No response ({0}). Is the server running?'],
    ['Nicht ersetzt (Variable fehlt in dieser Umgebung): {0}', 'Not replaced (variable missing in this environment): {0}'],
    ['Variable fehlt: {0}', 'Variable missing: {0}'],
    ['Kein Zugriff auf {0} erlaubt.', 'No access to {0} allowed.'],
    ['{0} antwortet mit {1}.', '{0} responds with {1}.'],
    ['Keine API-Doku auf {0} gefunden. Adresse über „Importieren“ von Hand angeben.', 'No API docs found on {0}. Enter the address manually via “Import”.'],
    ['{0}: {1} Endpoints in {2} Sammlung importiert{3}.', '{0}: {1} endpoints imported into {2} collection{3}.'],
    ['{0}: {1} Endpoints in {2} Sammlungen importiert{3}.', '{0}: {1} endpoints imported into {2} collections{3}.'],
    ['{0}: {1} Endpoints in {2} Sammlung aktualisiert{3}.', '{0}: {1} endpoints updated in {2} collection{3}.'],
    ['{0}: {1} Endpoints in {2} Sammlungen aktualisiert{3}.', '{0}: {1} endpoints updated in {2} collections{3}.'],
    [', Umgebung „{0}“ zu {1} hinzugefügt', ', environment “{0}” added to {1}'],
    [', Projekt „{0}“ angelegt', ', project “{0}” created'],
    ['{0}: {1} Requests importiert.', '{0}: {1} requests imported.'],
    ['{0}: {1} Request importiert.', '{0}: {1} request imported.'],
    ['{0} Projekte und {1} Sammlungen hinzugefügt.', '{0} projects and {1} collections added.'],
    ['Nach „{0}“ verschoben.', 'Moved to “{0}”.'],
    ['Erkannt: {0}', 'Detected: {0}'],
    ['Header ({0})', 'Headers ({0})'],
    ['{0} Felder', '{0} fields'],
    ['{0} Feld', '{0} field'],
    ['{0} Einträge', '{0} items'],
    ['{0} Eintrag', '{0} item'],
    ['… {0} weitere (siehe „Roh“)', '… {0} more (see “Raw”)'],
    ['{0} wirklich auch an Live senden?', 'Really send {0} to Live too?'],
    ['{0} Unterschiede', '{0} differences'],
    ['{0} Unterschiede (ignoriert: {1})', '{0} differences (ignored: {1})'],
    ['{0} geänderte Zeilen (− nur {1}, + nur {2})', '{0} changed lines (− only {1}, + only {2})'],
    ['Inhalt identisch, aber Status unterschiedlich ({0} / {1}).', 'Same content, but different status ({0} / {1}).'],
    ['{0} Fehler auf dieser Seite', '{0} error(s) on this page'],
    ['Aufnahme {0}', 'Recording {0}'],
    ['Zeile nicht verstanden: «{0}». Beispiel: Prod 2 = https://shop.ch', 'Line not understood: «{0}». Example: Prod 2 = https://shop.ch'],
    ['Zeile nicht verstanden: «{0}». Beispiel: X-Debug: true', 'Line not understood: «{0}». Example: X-Debug: true'],
    ['Ungültige Adresse: {0}', 'Invalid address: {0}'],
    ['Seiten beginnen mit / oder https://: «{0}». Beispiel: Backoffice = /backoffice', 'Pages start with / or https://: «{0}». Example: Backoffice = /backoffice'],
    ['Die Umgebung «{0}» gibt es in diesem Projekt nicht: «{1}»', 'The environment «{0}» does not exist in this project: «{1}»'],
    ['Ungültiger Header: {0}', 'Invalid header: {0}'],
    ['Antwortet nicht ({0}) · {1}', 'Not responding ({0}) · {1}'],
    ['Erreichbar · {0}', 'Reachable · {0}'],
    ['vor {0} Min.', '{0} min ago'],
    ['vor {0} Std.', '{0} h ago'],
    ['vor {0} T.', '{0} d ago'],
    ['Alle Seiten in allen Umgebungen öffnen ({0} Tabs)', 'Open all pages in all environments ({0} tabs)'],
    ['Alle {0} Seiten in {1} öffnen', 'Open all {0} pages in {1}'],
    ['Diese Seite · {0}', 'This page · {0}'],
    ['Wirklich auf {0} wechseln? Nochmals klicken.', 'Really switch to {0}? Click again.'],
    ['Für {0} ist noch kein Request markiert.', 'No request starred for {0} yet.'],
    ['Requests · {0}', 'Requests · {0}'],
    ['{0} cURL-Befehle erkannt, alle werden gespeichert.', '{0} cURL commands detected, all will be saved.'],
    ['cURL erkannt ({0} übernommen).', 'cURL detected ({0} applied).'],
    ['Gehört zu {0}, wird als Pfad gespeichert und gilt in allen Umgebungen.', 'Belongs to {0}, saved as a path and valid in all environments.'],
    ['{0} geändert', '{0} changed'],
    ['{0} nicht gepusht', '{0} unpushed'],
    ['{0} hinter', '{0} behind'],
    ['Vor {0}', 'Ahead of {0}'],
    ['Push {0}?', 'Push {0}?'],
    ['Zu {0} wechseln', 'Switch to {0}'],
    ['ab {0}', 'from {0}'],
    ['{0} Änderungen offen. Trotzdem?', '{0} open changes. Anyway?'],
    ['Gelöscht: {0}. Seite wird neu geladen.', 'Cleared: {0}. Reloading page.'],
    ['Daten von {0} löschen', 'Clear data of {0}'],
    ['Aufnahme läuft · {0} Requests', 'Recording · {0} requests'],
    ['Aufnahme läuft · {0} Request', 'Recording · {0} request'],
    ['{0} Requests aufgenommen', '{0} requests recorded'],
    ['{0} Request aufgenommen', '{0} request recorded'],
    ['{0} Requests als „{1}“ im API-Tester gespeichert.', '{0} requests saved as “{1}” in the API tester.'],
    ['Übernommen: {0} Umgebungen, {1} Requests.', 'Applied: {0} environments, {1} requests.'],
    ['Alle {0}', 'All {0}'],
    ['Konsole {0}', 'Console {0}'],
    ['Netz {0}', 'Network {0}'],
    ['Verbunden (Hilfsprogramm v{0}, {1}, Node {2})', 'Connected (helper v{0}, {1}, Node {2})'],
    ['Zuletzt übernommen: {0}', 'Last applied: {0}'],
    ['Geheime Werte ersetzt: {0}. Diese Variablen pro Umgebung setzen.', 'Secret values replaced: {0}. Set these variables per environment.'],
    ['{0} heruntergeladen. Ins Hauptverzeichnis des Repos legen und committen.', '{0} downloaded. Put it into the repository’s root folder and commit it.'],
    ['{0} in {1} schreiben', 'Write {0} to {1}'],
    ['Gespeichert: {0}. Jetzt committen, dann haben es alle.', 'Saved: {0}. Commit it now and everyone has it.'],
    ['Im Repo liegt noch keine {0}.', 'There is no {0} in the repository yet.'],
    ['{0}: {1} ({2} Umgebungen, {3} Requests) aus {4}.', '{0}: {1} ({2} environments, {3} requests) from {4}.'],
    // Hilfsprogramm
    ['{0} wurde nicht gefunden. In den Einstellungen den Pfad zu {1} angeben.', '{0} was not found. Enter the path to {1} in the settings.'],
    ['Zeitüberschreitung bei: {0}', 'Timeout at: {0}'],
    ['Ordner nicht gefunden: {0}', 'Folder not found: {0}'],
    ['Ungültiger Branch-Name: {0}', 'Invalid branch name: {0}'],
    ['Kein git- oder hg-Repo in {0}', 'No git or hg repository in {0}'],
    ['Pfad zu {0} muss vollständig sein, z. B. {1}', 'The path to {0} must be complete, e.g. {1}'],
    ['Unbekannte Aktion: {0}', 'Unknown action: {0}'],
    ['{0} Klick: senden', '{0} Click: send'],
    ['… {0} weitere', '… {0} more'],
  ];

  const norm = s => s.replace(/\s+/g, ' ');
  const keys = new Map(Object.entries(EN).map(([k, v]) => [norm(k), v]));
  const compiled = PATTERNS.map(([de, en]) => {
    const parts = norm(de).split(/\{(\d)\}/);
    let re = '^';
    const order = [];
    parts.forEach((p, i) => {
      if (i % 2) {
        re += '([\\s\\S]+?)';
        order.push(Number(p));
      } else re += p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    return { re: new RegExp(re + '$'), order, en, lit: de.replace(/\{\d\}/g, '').length };
  }).sort((a, b) => b.lit - a.lit);

  const detect = () => ((globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en');
  let lang = (() => {
    try {
      return localStorage.getItem('envswitch.lang') || null;
    } catch {
      return null;
    }
  })();
  if (lang !== 'de' && lang !== 'en') lang = detect();

  function tr(core, depth) {
    const k = norm(core);
    if (keys.has(k)) return keys.get(k);
    if (depth > 3 || k.length > 600) return core;
    for (const p of compiled) {
      const m = p.re.exec(k);
      if (!m) continue;
      const vals = {};
      p.order.forEach((n, i) => (vals[n] = tr(m[i + 1], depth + 1)));
      return p.en.replace(/\{(\d)\}/g, (_, n) => vals[n] ?? '');
    }
    return core;
  }

  // Übersetzt einen Text (Deutsch -> Englisch), wenn Englisch gewählt ist. Leerraum am Rand bleibt.
  function t(s) {
    if (lang !== 'en' || typeof s !== 'string') return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    if (!m[2]) return s;
    const r = tr(m[2], 0);
    return r === m[2] ? s : m[1] + r + m[3];
  }

  /* ---------- Seiten automatisch übersetzen ---------- */
  // Nicht übersetzt werden Eingaben, Code, Antworten und Meldungen fremder Seiten.
  const SKIP = 'textarea, pre, code, script, style, .out, .qout, .lm, .vars, [data-notr]';
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const skipText = n => {
    const el = n.parentElement;
    return !el || (el.closest(SKIP) && !el.closest('.j-n'));
  };
  function attrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const x = t(v);
      if (x !== v) el.setAttribute(a, x);
    }
  }
  function walk(n) {
    if (n.nodeType === 3) {
      if (skipText(n)) return;
      const x = t(n.data);
      if (x !== n.data) n.data = x;
    } else if (n.nodeType === 1) {
      attrs(n);
      if (n.matches(SKIP) && !n.querySelector('.j-n')) return;
      for (const c of n.childNodes) walk(c);
    }
  }
  function translatePage() {
    if (lang !== 'en' || typeof document === 'undefined') return;
    document.documentElement.lang = 'en';
    walk(document.documentElement);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') walk(m.target);
        else if (m.type === 'attributes') attrs(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  return {
    t,
    get lang() {
      return lang;
    },
    get locale() {
      return lang === 'de' ? 'de-CH' : 'en-GB';
    },
    // Gewählte Sprache: 'auto' | 'de' | 'en'
    async load() {
      try {
        const { prefs } = await chrome.storage.local.get('prefs');
        const want = prefs?.lang && prefs.lang !== 'auto' ? prefs.lang : detect();
        if (want !== lang) lang = want;
        try {
          localStorage.setItem('envswitch.lang', lang);
        } catch {}
      } catch {}
      return lang;
    },
    translatePage,
  };
})();
globalThis.T = s => I18N.t(s);
if (typeof document !== 'undefined') {
  I18N.translatePage();
  // Sprache kann sich geändert haben (Einstellungen): dann einmal neu laden
  const before = I18N.lang;
  I18N.load().then(l => {
    if (l !== before) location.reload();
  });
} else {
  I18N.load();
}
