# EnvSwitch-Hilfsprogramm

Kleines Node-Programm, über das der Branch Manager von EnvSwitch git- und hg-Befehle ausführt (Chrome „Native Messaging“).

## Einrichten

1. Node.js installieren (falls nicht vorhanden): `node -v` muss eine Version zeigen.
2. In EnvSwitch die **Einstellungen** öffnen und den Befehl unter „Hilfsprogramm einrichten“ kopieren.
3. In diesem Ordner ein Terminal öffnen und den Befehl ausführen:

   ```
   node install.js <Extension-ID>
   ```

4. In den Einstellungen auf **Verbindung prüfen** klicken. Falls es nicht klappt: Chrome ganz schliessen und neu öffnen.

Funktioniert auf macOS, Windows und Linux, für Chrome, Edge, Brave und Chromium. Auf mehreren Computern jeweils dort ausführen. Wird dieser Ordner verschoben, `install.js` nochmals ausführen.

Entfernen: `node install.js --uninstall`

## Was das Programm darf

Nur diese Aktionen, in einem Ordner, der ein git- oder hg-Repo ist: Status, Branches auflisten, letzte Commits, Branch wechseln, Branch erstellen, Pull, Push, Fetch. Befehle laufen ohne Shell, Branch-Namen werden geprüft, und es wird nie auf eine Passwort-Eingabe gewartet. Für Pull/Push muss die Anmeldung schon eingerichtet sein (SSH-Key oder gespeicherte Zugangsdaten).

- git: `git switch`, `git switch -c`, `git pull --ff-only` (einstellbar), `git push -u origin HEAD`, `git fetch --prune`
- hg: `hg update --check`, `hg branch` bzw. `hg bookmark`, `hg pull --update`, `hg push -r . --new-branch`
