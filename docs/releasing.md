# Releasing Grok Cockpit

Do not commit certificates, `.p12`, `.p8`, or Apple API keys.

## Unsigned snapshot

```bash
npm test
npm run typecheck
npm run dist:unsigned
npm run dist:checksums
```

`dist:unsigned` writes an arm64 DMG. Universal builds fail because `node-pty` ships a native binary electron-builder cannot merge. Gatekeeper will require right-click → Open on first launch. This is the v0.1.0 safety build.

Packaged apps still spawn the user-installed `grok` binary (`~/.grok/bin/grok`). They do not bundle the agent.

## Notarized release

Notarization is not part of the 0.1.0 freeze. When credentials exist in the environment, follow Worktree Manager’s `docs/releasing.md` (`APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, Developer ID Application). Do not copy that repo’s certificate into this one.
