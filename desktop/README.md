# AEFlow Desktop

Lightweight **Tauri v2 (Rust) + React 19 + Tailwind CSS v4** desktop companion for [AgentEverywhereFlow](https://github.com/mcocdaa/AgentEverywhereFlow).

Built around a calm, frameless, Raycast / Codex / Zoom-Screen-Share interaction model: summon from anywhere via global shortcut, visually pick a window / custom region / headless browser tab, type naturally with streaming execution, and stay completely out of the target viewport's way.

---

## Architecture Overview

AEFlow Desktop pairs a lean native Rust shell (~10 MB) with the headless Python `agenteverywhereflow` daemon installed via `uv`:

```text
+-------------------------------------------------------------------+
|                     AEFlow Desktop (Tauri v2)                     |
|  System Tray + Global Shortcut (Alt+Space / Ctrl|Cmd+Shift+A)     |
|                                                                   |
|  4 Lightweight Frameless Transparent Windows (1 React bundle):    |
|   1. ?view=command — Floating Codex command popup (640x120..520)  |
|   2. ?view=picker  — Fullscreen Hover / Region / Grid / CDP picker|
|   3. ?view=border  — Click-through 2px glowing target perimeter   |
|   4. ?view=pill    — Top-center Dynamic status & approval capsule |
+---------------------------------+---------------------------------+
                                  | Localhost REST + WS
                                  | Auto-attach ~/.aef/daemon.json
                                  | or auto-spawn `aef serve` via uv
                                  v
+-------------------------------------------------------------------+
|              AEFlow Headless Daemon (`aef serve`)                 |
|  Installed via `uv tool install agenteverywhereflow`              |
+-------------------------------------------------------------------+
```

### Zero-Friction `uv` Backend Pairing

On startup (`discover_or_start_daemon` in `src-tauri/src/daemon.rs`):

1. **Attach-first**: Reads `~/.aef/daemon.json` and probes `GET http://127.0.0.1:<port>/api/v1/health`. If an existing `aef serve` or `aef ui` daemon is running, AEFlow Desktop attaches transparently without spawning duplicates.
2. **Managed auto-spawn**: If no daemon is active, AEFlow Desktop locates `aef` (or `uvx`) on `PATH` / `~/.local/bin`, starts `aef serve --host 127.0.0.1 --port <free_port>` silently as a managed child process, and cleanly terminates it when the desktop app quits.
3. **One-click `uv` bootstrap**: If `aef` is missing on a fresh machine, the floating popup shows a minimal onboarding card allowing one-click `uv tool install agenteverywhereflow` (via `bootstrap_via_uv`) followed by inline Model / API Key configuration (`PATCH /api/v1/config`).

---

## Development

### Prerequisites

- **Node.js** 20+ (`npm`)
- **Rust** 1.77+ (`cargo`, `rustc`)
- **Linux system libs** (Ubuntu/Debian): `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`
- **Python backend** (optional for browser preview, required for live automation):
  ```bash
  uv tool install agenteverywhereflow
  ```

### Frontend Preview Mode (Plain Browser)

All 4 views (`command`, `picker`, `border`, `pill`) run interactively in a normal browser with graceful mock fallbacks and a subtle bottom preview switcher:

```bash
cd desktop
npm install
npm run dev
# Open http://localhost:1420
```

### Full Native Desktop Development (Tauri v2)

```bash
cd desktop
npm install
npm run tauri dev
```

### Typecheck, Build & Rust Verification

```bash
cd desktop
npx tsc --noEmit
npm run build
cd src-tauri && cargo check
```

### Packaging Native Installers (`.dmg`, `.msi`, `.AppImage`, `.deb`)

```bash
cd desktop
npm run tauri build
```

---

## Global Shortcuts & Tray

- **Summon / Toggle**: `Alt+Space` (automatic fallback to `Ctrl+Shift+A` on Windows/Linux or `Cmd+Shift+A` on macOS if `Alt+Space` is occupied).
- **Slash Commands**: `/pick`, `/mode`, `/perm`, `/studio`, `/settings`, `/clear`.
- **Visual Picker**: Hover + click to bind window, click-drag to crop a custom `REGION` target, press `Tab` to toggle the live Thumbnail Grid (with multi-target selection), or switch to **Headless Browser CDP** for background zero-interference tabs.
- **System Tray Menu**: Summon AEFlow, Select Target Window, Open WebUI Studio, Restart Local Engine, Quit.
