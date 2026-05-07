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
node injector.js [path/to/your/script.js]
```

This will open Modrinth (if not already running) and execute the provided script inside the console. The `[path/to/your/script.js]` is an optional argument. If not provided, `default.js` will be used.

**Example:**

To use the default script:
```bash
node injector.js
```

To use a custom script named `my-custom-script.js` located in the current directory:
```bash
node injector.js my-custom-script.js
```
