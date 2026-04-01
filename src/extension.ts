import * as vscode from "vscode"
import * as fs from "fs"
import * as path from "path"

let replacements = new Map<string, string>()
let replacementPattern: RegExp | null = null
const transformCache = new Map<string, string>()

function loadReplacements(workspaceRoot: string): void {
  const jsonPath = path.join(workspaceRoot, "textreplace.json")
  replacements.clear()
  replacementPattern = null
  transformCache.clear()

  try {
    if (!fs.existsSync(jsonPath)) return

    const raw = fs.readFileSync(jsonPath, "utf-8")
    const parsed = JSON.parse(raw) as Record<string, string>

    for (const [from, to] of Object.entries(parsed)) {
      if (
        typeof from === "string" &&
        typeof to === "string" &&
        from.length > 0
      ) {
        replacements.set(from, to)
      }
    }

    if (replacements.size > 0) {
      // Sort by descending length so longer matches take priority
      const escaped = [...replacements.keys()]
        .sort((a, b) => b.length - a.length)
        .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      replacementPattern = new RegExp(escaped.join("|"), "g")
    }
  } catch (e) {
    vscode.window.showErrorMessage(
      `textreplace: Failed to parse textreplace.json — ${e}`,
    )
  }
}

export function activate(context: vscode.ExtensionContext) {
  const hiddenDecorationType =
    vscode.window.createTextEditorDecorationType({
      textDecoration:
        "none; opacity: 0 !important; visibility: hidden;",
      color: "var(--vscode-editor-foreground)",
    })

  // ── Load & watch ─────────────────────────────────────────────────────────

  function reloadAndUpdate(): void {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (root) loadReplacements(root)
    updateDecorations()
  }

  // VS Code file system watcher (reliable across platforms)
  const fsWatcher = vscode.workspace.createFileSystemWatcher(
    "**/textreplace.json",
  )
  fsWatcher.onDidChange(reloadAndUpdate, null, context.subscriptions)
  fsWatcher.onDidCreate(reloadAndUpdate, null, context.subscriptions)
  fsWatcher.onDidDelete(reloadAndUpdate, null, context.subscriptions)
  context.subscriptions.push(fsWatcher)

  // ── Decoration helpers ────────────────────────────────────────────────────

  function updateDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      updateDecorationsForEditor(editor)
    }
  }

  function updateDecorationsForEditor(
    editor: vscode.TextEditor,
  ): void {
    if (!replacementPattern || replacements.size === 0) {
      editor.setDecorations(hiddenDecorationType, [])
      return
    }

    const decorations: vscode.DecorationOptions[] = []

    for (const visibleRange of editor.visibleRanges) {
      const text = editor.document.getText(visibleRange)
      const baseOffset = editor.document.offsetAt(visibleRange.start)

      replacementPattern!.lastIndex = 0

      let match: RegExpExecArray | null
      while ((match = replacementPattern!.exec(text)) !== null) {
        const original = match[0]
        const transformed = replacements.get(original) ?? original

        if (transformed === original) continue

        const matchOffset = baseOffset + match.index

        // Character-by-character diff — identical to the owo approach so
        // substitutions, insertions, and deletions all render correctly.
        for (
          let i = 0, j = 0;
          i < original.length || j < transformed.length;
        ) {
          const oldChar = original[i]
          const newChar = transformed[j]
          const startPos = editor.document.positionAt(matchOffset + i)

          if (oldChar === newChar) {
            i++
            j++
            continue
          }

          if (
            oldChar &&
            newChar &&
            original[i + 1] === transformed[j + 1]
          ) {
            // Simple substitution: one char → one char
            const endPos = editor.document.positionAt(
              matchOffset + i + 1,
            )
            decorations.push({
              range: new vscode.Range(startPos, endPos),
              renderOptions: {
                before: {
                  contentText: newChar,
                  color: "inherit",
                  textDecoration:
                    "none; position: absolute; width: 1ch;",
                },
              },
            })
            i++
            j++
          } else if (newChar && oldChar === transformed[j + 1]) {
            // Insertion: add a char without consuming original
            decorations.push({
              range: new vscode.Range(startPos, startPos),
              renderOptions: {
                before: {
                  contentText: newChar,
                  color: "inherit",
                  textDecoration:
                    "none; position: relative; display: inline-block; width: 1ch;",
                },
              },
            })
            j++
          } else if (oldChar && original[i + 1] === newChar) {
            // Deletion: hide a char without emitting a replacement
            const endPos = editor.document.positionAt(
              matchOffset + i + 1,
            )
            decorations.push({
              range: new vscode.Range(startPos, endPos),
            })
            i++
          } else {
            // Fallback: hide original char (if any) and emit new char (if any)
            const endPos = editor.document.positionAt(
              matchOffset + (oldChar ? i + 1 : i),
            )
            decorations.push({
              range: new vscode.Range(startPos, endPos),
              renderOptions: {
                before: {
                  contentText: newChar || "",
                  color: "inherit",
                  textDecoration:
                    oldChar ?
                      "none; position: absolute; width: 1ch;"
                    : "none; position: relative;",
                },
              },
            })
            if (oldChar) i++
            if (newChar) j++
          }
        }
      }
    }

    editor.setDecorations(hiddenDecorationType, decorations)
  }

  // ── Event subscriptions ───────────────────────────────────────────────────

  vscode.workspace.onDidChangeTextDocument(
    updateDecorations,
    null,
    context.subscriptions,
  )
  vscode.window.onDidChangeActiveTextEditor(
    updateDecorations,
    null,
    context.subscriptions,
  )
  vscode.window.onDidChangeTextEditorVisibleRanges(
    (e) => {
      updateDecorationsForEditor(e.textEditor)
    },
    null,
    context.subscriptions,
  )

  vscode.workspace.onDidChangeWorkspaceFolders(
    reloadAndUpdate,
    null,
    context.subscriptions,
  )

  // ── Commands ──────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("textreplace.reload", () => {
      reloadAndUpdate()
      vscode.window.showInformationMessage(
        `textreplace: Reloaded — ${replacements.size} replacement(s) active.`,
      )
    }),

    vscode.commands.registerCommand(
      "textreplace.openConfig",
      async () => {
        const root =
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        if (!root) {
          vscode.window.showWarningMessage(
            "textreplace: No workspace folder is open.",
          )
          return
        }
        const configPath = path.join(root, "textreplace.json")
        if (!fs.existsSync(configPath)) {
          const stub = JSON.stringify(
            { TODO: "DONE", fixme: "fixed", hello: "hi" },
            null,
            2,
          )
          fs.writeFileSync(configPath, stub, "utf-8")
        }
        const doc =
          await vscode.workspace.openTextDocument(configPath)
        vscode.window.showTextDocument(doc)
      },
    ),
  )

  // ── Initial load ──────────────────────────────────────────────────────────

  reloadAndUpdate()
}

export function deactivate() {}
