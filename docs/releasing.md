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

## Signed release

`npm run dist:signed` builds an arm64 DMG and ZIP with the Developer ID Application identity `Arjun Gupta (49K92AGPFW)`, hardened runtime, and the entitlements in `build/entitlements.mac.plist`. electron-builder discovers that identity in the login keychain. Do not pass `--config.mac.identity=null` on this path.

The app stays arm64-only because `node-pty` cannot be merged into a universal binary.

## Notarized release

Notarization needs `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER` in the environment, then `electron-builder` notarize or `xcrun notarytool`. The issuer UUID is not stored in this repo. Until it is supplied, signed builds are Developer ID signed and not stapled. Gatekeeper may still require a right-click Open on first launch.
