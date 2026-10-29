# Stagio helper / Hilfsprogramm

Small Node program that lets the Stagio **Branch Manager** run git and hg (Chrome native messaging). Everything else in Stagio works without it.

## Install

Requires [Node.js](https://nodejs.org) 18+. Copy the command from Stagio → Settings → Branch Manager (it contains your extension ID) and run it in a terminal:

```
npx stagio-helper <extension-id>
```

Or, inside this folder: `node install.js <extension-id>`.

Then click **Check connection** in the settings. If it does not work, quit Chrome completely once and reopen it.

The program is copied to `~/.stagio` (macOS/Linux) or `%LOCALAPPDATA%\Stagio` (Windows) and registered for Chrome, Edge, Brave and Chromium. Run it on every computer you use. Uninstall: `npx stagio-helper --uninstall`. More: https://stagio.dev/helper.html

## What it may do

Only these actions, only inside a folder that is a git or hg repository: status, list branches, recent commits, switch branch, create branch, pull, push, fetch, and read/write the file `.stagio.json` in the repository root (team configuration). Commands run without a shell, branch names are validated, and it never waits for a password prompt (pull/push need SSH keys or saved credentials).

- git: `git switch`, `git switch -c`, `git pull --ff-only` (configurable), `git push -u origin HEAD`, `git fetch --prune`
- hg: `hg update --check`, `hg branch` / `hg bookmark`, `hg pull --update`, `hg push -r . --new-branch`

---

**Deutsch:** Kleines Node-Programm, über das der Branch Manager git und hg ausführt. Einrichten: Befehl aus Stagio → Einstellungen kopieren und im Terminal ausführen (`npx stagio-helper <ID>`), dann „Verbindung prüfen“. Es darf nur die oben genannten Aktionen ausführen.
