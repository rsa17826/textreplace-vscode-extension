# Text Replace — VS Code Extension

Visually replace any text in your editor using a simple JSON config file. No files are modified on disk — replacements are rendered using decorations, just like the cursor.

## Usage

1. Create a `textreplace.json` in your **project root** (or run **"Text Replace: Open / Create textreplace.json"** from the Command Palette).
2. Add your replacements as key → value pairs:

```json
{
  "TODO":        "✅ DONE",
  "FIXME":       "🔧 FIXED",
  "console.log": "logger.debug",
  "any":         "unknown"
}
```

3. Save the file — decorations update instantly, no restart needed.

## Rules

- **Keys** are matched as exact literal strings (case-sensitive).
- **Longer keys take priority** over shorter ones when they overlap.
- Replacements only affect the visual display — your actual source files are untouched.
- The file is watched for changes and reloads automatically.

## Commands

| Command | Description |
|---|---|
| `Text Replace: Reload textreplace.json` | Force reload (useful after external edits) |
| `Text Replace: Open / Create textreplace.json` | Opens the config, creating a stub if it doesn't exist |

## How to Build & Install

```bash
npm install
npm run compile
```

Then press `F5` in VS Code to launch the Extension Development Host, or package it with `vsce package`.

## Tips

- Use emoji in the replacement value for quick visual markers.
- Works great for aliasing verbose patterns (`console.log` → `log`, `parseInt` → `Number.parseInt`).
- Add `textreplace.json` to `.gitignore` if your replacements are personal/local.


```sh
echo y|npx @vscode/vsce package --allow-missing-repository
```

