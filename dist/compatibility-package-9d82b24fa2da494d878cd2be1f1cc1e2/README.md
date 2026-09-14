# Cuterinth
Make Modrinth cuter, cleaner, and more customizable with themes and addons.

## Compatibility update — September 14, 2026

Verified with the installed Modrinth App **0.21.0** on Windows.

- Theme previews inherit the current app's styling, including its settings dialog.
- Switching back to a native theme restores its colors without leftover custom variables.
- Invalid imports show an error, and deleted presets stay deleted on restart.
- Theme controls mount when settings open, without a recurring whole-page scan.
- The Windows launcher restores customization after a page reload. Connection errors
  offer Retry, including when an updater restarts Modrinth without debugging enabled.

Resource Management now shows a message while Modrinth calculates content storage.
This calculation is performed by Modrinth itself; on the tested library it took about
1.8 seconds. Cuterinth does not skip the calculation or substitute cached disk totals.

## Use the Windows app

Download and extract the Windows release, then open `Cuterinth.exe` (or
`dist\Cuterinth.exe` after building from source). It launches Modrinth and loads Cuterinth automatically;
Node.js is not required.

Uploaded themes and the selected theme are also backed up to
`%APPDATA%\Cuterinth\themes.json`. Keep Cuterinth running in the background while
Modrinth is open so changes can be saved. The backup is restored automatically the
next time Cuterinth starts, even if Modrinth clears its browser storage.

Each time the Windows app starts, it automatically checks the
[GitHub themes folder](https://github.com/FoxyKid23256/Cuterinth-Working-Fixed-/tree/main/themes)
on the `main` branch and downloads its JSON themes. New presets and updates appear
automatically; rebuilding the EXE is not required. Imported themes with the same
name are preserved, and your selected theme stays selected.

Downloaded presets are cached in `%APPDATA%\Cuterinth\github-themes.json`.
If GitHub is unavailable or rate-limited, the app uses cached themes and the
presets bundled from the local `themes` folder. Invalid files are skipped, and
the entire download attempt has a 15-second timeout. Previously downloaded
presets remain available even if removed from GitHub. Download details are
written to `%APPDATA%\Cuterinth\Cuterinth.log`.

If Modrinth is already running, close it completely before opening Cuterinth so
the required WebView debugging option can be enabled.
If an update interrupts the connection, close Modrinth and choose **Retry** in Cuterinth.

## Build the EXE

On Windows with the .NET Framework 4.x C# compiler installed, right-click
`build-exe.ps1` and choose **Run with PowerShell**, or run:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-exe.ps1
```

The finished app is written to `dist\Cuterinth.exe`. The customization code from
`default.js` is embedded into the executable during the build.

Run the theme download/cache checks without launching Modrinth:

```powershell
powershell -ExecutionPolicy Bypass -File .\test-themes.ps1
```

With Cuterinth and Modrinth running, run browser regression checks in an isolated
test frame (using in-memory theme storage, without changing your saved themes):

```powershell
powershell -ExecutionPolicy Bypass -File .\test-browser.ps1
```

# Cuterinth Themes
A default theme is a JSON file structured like this:
```json
{
  "name": "Theme Name",
  "author": "Your Name",
  "vars": { "--style": "#fff" }
}
```

Every time you open it, Cuterinth will automatically launch Modrinth and inject its code.
Download a theme or create your own to make it look cute and nice.

# JavaScript development usage

```bash
npm ci
node injector.js
```

This opens Modrinth and injects `default.js`. The Windows launcher provides the
automatic GitHub theme downloads and disk backups; this development entry point
requires Node.js and does not provide those launcher features.
