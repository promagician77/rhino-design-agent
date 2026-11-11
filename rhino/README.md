# Rhino side

These files run inside Rhino 8 (Script Editor, CPython 3). They are the only code that changes the client's model.

| File | What it is | Tested here |
|---|---|---|
| `generator.py` | Spec to solid parts. Mirror of `src/model/generate.js` | Yes: rebuilds every exported .3dm with 0 mm difference |
| `sync.py` | Detects manual edits (moved, deleted, extra objects) before the agent changes anything | Yes: on real .3dm files |
| `design_tools.py` | RhinoCommon functions: `bake`, `check_drift`, `setup_views`, `capture`, `save_version`, `restore`, `read_spec` | Parses; not run (no Rhino licence in this environment) |
| `verify_3dm.py` | Opens .3dm files with McNeel's rhino3dm and checks them | Yes |
| `materials.json` | Material library, written by `tools/export.mjs` | |

## How the app talks to Rhino

1. In Rhino 8, install McNeel's Rhino MCP server from the Package Manager (Rhino 9 BETA includes it) and start it
   (`MCPConnect` sets up a client; the server can also be started on a port).
2. The app is the only MCP client. The language model never connects to Rhino.
3. For each approved change the app sends one fixed line through the server's script tool:

   ```python
   import sys; sys.path.insert(0, r"C:\path\to\rhino")
   import design_tools; print(design_tools.dispatch_b64("<base64 of {name, args}>"))
   ```

   `dispatch` only accepts the seven names in `ALLOWED`. Arguments are plain JSON, carried as base64, so a label or a
   material name can never become code.
4. `bake` touches only objects tagged with a `part` user string, only where they differ from the spec, inside one
   undo record. Ctrl+Z in Rhino reverts a whole agent change. The designer's own untagged objects are never touched.
5. Before every change the app calls `check_drift`. If the designer moved, deleted or added tagged objects by hand,
   the agent stops and asks whether to keep the manual edit (measure it into the spec) or rebuild from the spec.

## Why not let the model drive Rhino directly

McNeel groups Rhino AI tools as read-only, modify and destructive; running scripts and saving files are destructive.
Unchecking a group hides it from agents in Rhino's own panel, but external MCP clients still see every tool
(https://www.rhino3d.com/for/ai/). A model connected straight to the server could run any script on the open file.
Here it can only request the nine typed actions in `src/agent/tools.js`.

## Checks to run in the PoC (not possible here)

- `setup_views()` then `capture('hero')` on the reconstructed room; compare with the three.js preview.
- `bake` timing on the client's room size; undo of a full agent change with Ctrl+Z.
- `save_version` and `restore` round trip on the studio's network folder.
