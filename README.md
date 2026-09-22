# Grok Cockpit

Personal macOS Electron app that wraps **live Grok Build TUI sessions** with Nutshell chrome: session resume, Linear ticket launch, `/private/tmp/<slug>-wt` worktrees, skill palette, MCP health, and a git diff pane.

Each tab is a native ACP chat against the installed `grok` binary. The header **TUI** button resumes the same session in the embedded terminal. Packaged apps do not bundle grok.

## Run

```bash
cd ~/source/grok-cockpit
npm install
npm test
npm run dev
```

Or double-click `Open Grok Cockpit.command` (chmod +x once).

`postinstall` rebuilds `node-pty` for Electron. If that fails:

```bash
npx electron-rebuild -f -w node-pty
```

## Daily use

- **⌘T** — new Grok session (also on the Sessions sidebar button)
- **⌘⇧/** — Cockpit README preview
- **⌘⇧A** — About / Worktree Manager
- **⌘W** — close tab (does not quit the app)
- **⌘1–9** — switch tabs
- **⌘K** — skill / slash palette (`implement-ticket AVA-12 --paired`)
- **⌘⇧D** — toggle git diff pane
- Linear tab — pick a ticket; worktree create **or attach** if `/private/tmp/<slug>-wt` exists
- Sessions resume in the worktree they belong to, not always the main checkout
- Tabs persist across quit; the last focused tab respawns Grok
- Git files open in Cursor; status bar opens `gh pr view --web` when a PR exists
- Background tabs can notify when Grok goes idle (Settings)

Worktrees use `/private/tmp/<slug>-wt` and `.cursor/hooks/worktree-setup.sh`. Do **not** use `grok --worktree` from this app.

## Install

Signed arm64 builds are GitHub releases on [Arjun2908/grok-cockpit](https://github.com/Arjun2908/grok-cockpit/releases). Coworkers need access to that private repo, then download `Grok-Cockpit-<version>-arm64.dmg`. The app is Developer ID signed. It is not notarized until an App Store Connect issuer is configured, so the first open may need a right-click → Open.

## PTY checklist

Confirm in a live tab:

- [ ] TUI paints (alt-screen, colors)
- [ ] Type, Enter sends, Shift+Enter / Alt+Enter inserts a newline, `@` picker, `/` menu
- [ ] Cmd+C copies a selection; Ctrl+C still cancels in Grok
- [ ] Cmd+V pastes text, or a screenshot/image (saved and `@`-attached; thumbnail strip to view)
- [ ] Drop a file inserts `@/abs/path` (images also appear in the strip)
- [ ] `/quit` closes the tab; the app stays up
- [ ] Window resize refits

xterm.js cannot tell Shift+Enter from Enter, so Cockpit maps Shift+Enter and Alt+Enter to Grok’s newline fallback (`Esc`+Enter). Kitty-protocol chords (some Ctrl+Enter variants) may still not reach the TUI; use the slash menu.

Screenshots and Copy Image on Cmd+V are written to a temp PNG and attached with `@path` so Grok sees them. Click the thumbnail strip to view. The status bar shows `grok usage` for the tab’s session (`$x.xx`; click copies details).

Idle notifications use 8s of PTY silence while the window is unfocused. Grok OSC notifications may also appear depending on Electron.

## Linear

Settings (⌘,) stores a Linear API key in Electron `userData`, not in this repo. You can also set `LINEAR_API_KEY`. Without a key, type a ticket id and launch anyway.

## PHPUnit

Two tabs in the **same** worktree path show a warning. Nutshell PHPUnit shares a database — don’t run tests in both.

## Package

```bash
npm run dist:unsigned
```

See `docs/releasing.md`. v0.1.0 is the embedded-TUI snapshot. A native ACP chat client replaces the terminal after this tag.

## Out of scope

Driving `/mcps` OAuth from the chrome, notarized DMG in 0.1.0, auto-commit / `gh pr create`.
