# Grok Cockpit

A macOS app for daily work in [Grok](https://x.ai/grok). Each session is a native chat against the `grok` you already have installed. Linear, worktrees, and the git pane stay beside it. If the chat is not the right surface yet, one button resumes that same session in the Grok terminal.

Apple silicon only. The app does not bundle `grok`.

## Install

Download the latest disk image from [Releases](https://github.com/Arjun2908/grok-cockpit/releases/latest):

**[Grok Cockpit 0.2.0](https://github.com/Arjun2908/grok-cockpit/releases/tag/v0.2.0)** · `Grok-Cockpit-0.2.0-arm64.dmg`

The build is Developer ID signed and notarized. Open the DMG, drag Grok Cockpit to Applications, and launch it.

You also need:

- An Apple silicon Mac
- [Grok](https://x.ai/grok) installed, so `~/.grok/bin/grok` exists
- A GitHub login only if you want to build from source

## Use it

Open the app. **⌘T** starts a session in your default repo. The session list on the left resumes an older one, including one that lives in a worktree.

| | |
| --- | --- |
| **⌘T** | New session |
| **⌘W** | Close the tab. The app stays open |
| **⌘1–9** | Switch tabs |
| **⌘K** | Skill palette |
| **⌘⇧D** | Git changes |
| **⌘⇧/** | This README, inside the app |
| **⌘,** | Settings |

**TUI** in the header leaves native chat and opens the embedded Grok terminal on the same saved session. **Chat** comes back. Switching stops the turn that is running.

In chat, Enter sends and Shift+Enter inserts a newline. `/` opens session commands. `@` attaches a file path. A question or a permission stays on screen until you answer it, and that answer is what the agent receives.

The Linear tab uses a key from Settings, or `LINEAR_API_KEY` in the environment. Without a key you can still type a ticket id and launch it. Worktrees are created at `/private/tmp/<slug>-wt`. Do not start them with `grok --worktree` from this app.

Two tabs in the same worktree can share Nutshell’s PHPUnit database. The app warns when that happens. Run one test process at a time.

## Build from source

```bash
git clone https://github.com/Arjun2908/grok-cockpit.git
cd grok-cockpit
npm install
npm test
npm run dev
```

`npm install` rebuilds `node-pty` for Electron. If that step fails:

```bash
npx electron-rebuild -f -w node-pty
```

## Releases

Published builds are arm64 DMGs named `Grok-Cockpit-<version>-arm64.dmg`. Checksums are in `SHA256SUMS` on the same release.

How the next notarized DMG is produced is in [docs/releasing.md](docs/releasing.md). The app does not yet install updates by itself. Download the next release from this page.
