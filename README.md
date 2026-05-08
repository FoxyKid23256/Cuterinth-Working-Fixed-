# Cuterinth
Make Modrinth cuter, cleaner, and more customizable with themes and addons.

# Cuterinth Themes
A default theme is a JSON file structured like this:
```json
{
  "name": "Theme Name",
  "author": "Your Name",
  "vars": { "--style": "#fff" }
}
````

Every time you open it, Cuterinth will automatically launch Modrinth and inject its code.
Download a theme or create your own to make it look cute and nice.

# Injector Usage

```bash
node injector.js
```

This will open Modrinth (if not already running) and execute the script.js code inside the console.
