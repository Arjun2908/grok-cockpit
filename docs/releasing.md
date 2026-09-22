# Releasing Grok Cockpit

Do not commit certificates, `.p12`, `.p8`, or Apple API keys.

Builds stay arm64. `node-pty` ships one native binary, so a universal DMG cannot be merged. Packaged apps launch the user-installed `grok` at `~/.grok/bin/grok`. They do not bundle the agent.

## What a release is

1. Bump `version` in `package.json` and `package-lock.json`.
2. Add a `CHANGELOG.md` section for that version.
3. Commit on `main` and push.
4. Tag `v<version>` and push the tag.

Pushing `v*` runs [`.github/workflows/release.yml`](../.github/workflows/release.yml) on a macOS runner. That job installs dependencies, runs tests, signs with the Developer ID certificate, notarizes the DMG and ZIP, staples the DMG, writes checksums, and publishes the GitHub release.

The app does not check for updates. People download the new DMG from Releases. `latest-mac.yml` is uploaded so an in-app updater can be added later without changing the release layout.

## One-time GitHub secrets

The workflow refuses to publish until these Actions secrets exist. Set them on the repository, not in git.

| Secret | What it is |
| --- | --- |
| `MACOS_CERTIFICATE_P12_BASE64` | Base64 of the Developer ID Application `.p12` for team `49K92AGPFW` |
| `MACOS_CERTIFICATE_PASSWORD` | Password for that `.p12`. This is the one secret that is not stored next to the key. Set it yourself. |
| `APPLE_API_KEY_P8` | Contents of the App Store Connect API key |
| `APPLE_API_KEY_ID` | Key id, currently `KUSMK64A9Y` |
| `APPLE_API_ISSUER` | Issuer ID from App Store Connect → Users and Access → Integrations |

```bash
base64 -i developer-id.p12 | gh secret set MACOS_CERTIFICATE_P12_BASE64 -R Arjun2908/grok-cockpit
gh secret set MACOS_CERTIFICATE_PASSWORD -R Arjun2908/grok-cockpit
gh secret set APPLE_API_KEY_P8 -R Arjun2908/grok-cockpit < AuthKey_KUSMK64A9Y.p8
gh secret set APPLE_API_KEY_ID -R Arjun2908/grok-cockpit
gh secret set APPLE_API_ISSUER -R Arjun2908/grok-cockpit
```

After those five exist, `git tag v0.2.1 && git push origin v0.2.1` is the whole release. No local notarization step.

## Signed build on this Mac

Useful when the Actions secrets are not in place yet.

```bash
npm test
npm run dist:signed
```

Then notarize with the API key that already lives outside the repo:

```bash
export APPLE_API_KEY="$HOME/Me/Worktree Manager Keys/AuthKey_KUSMK64A9Y.p8"
export APPLE_API_KEY_ID=KUSMK64A9Y
export APPLE_API_ISSUER=<issuer uuid>

codesign --force --timestamp --sign "Developer ID Application: Arjun Gupta (49K92AGPFW)" release/Grok-Cockpit-*.dmg
xcrun notarytool submit release/Grok-Cockpit-*.dmg --key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER" --wait
xcrun stapler staple release/Grok-Cockpit-*.dmg
xcrun notarytool submit release/Grok-Cockpit-*.zip --key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER" --wait
npm run dist:checksums
```

ZIP files cannot be stapled. The DMG can. Upload the DMG, ZIP, blockmap, `latest-mac.yml`, and `SHA256SUMS` to the GitHub release.

v0.2.0 was produced this way. Gatekeeper reports `source=Notarized Developer ID`.

## Unsigned snapshot

```bash
npm run dist:unsigned
```

Gatekeeper will require a right-click → Open. Do not publish this build as a release.
