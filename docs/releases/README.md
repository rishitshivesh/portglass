# Local releases and Homebrew

Build, sign, notarize and publish Portglass from your Mac. **GitHub Actions is not required.** GitHub hosts release downloads and the custom Homebrew tap; its CLI uses your existing local login. CI is manual-only, and there are no automatic release workflows or tag-triggered jobs.

Public distribution remains blocked until a valid Developer ID Application identity is available locally. The current doctor also reports the Intel Rust target missing. No signed public release or installable cask exists yet. Start with [Apple signing setup](apple-signing.md).

## Downloads people can use

Each release contains the same universal, signed/notarized app for Apple Silicon and Intel, configured for macOS 12 or later:

| File                                     | Installation                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `Portglass-X.Y.Z-universal-macos.dmg`    | Open the disk image and drag Portglass.app to its Applications shortcut              |
| `Portglass-X.Y.Z-universal-macos.zip`    | Extract and move Portglass.app to Applications                                       |
| `Portglass-X.Y.Z-universal-macos.tar.gz` | Extract and move Portglass.app to Applications                                       |
| `SHA256SUMS`                             | Checksums for all three downloads                                                    |
| `release-manifest.json`                  | Source commit, version, architectures, notarization policy and download hashes/sizes |

The DMG is a read-only compressed disk image containing the app and an Applications shortcut. It uses `hdiutil`; building it does not automate Finder or require an installer package. ZIP/TAR preserve the stapled app. These are direct-download distribution formats, with no Mac App Store listing required. [Tauri's DMG guidance](https://v2.tauri.app/distribute/dmg/)

## One-time setup

- Follow [Apple signing setup](apple-signing.md): local Developer ID Application certificate/private key, Keychain notarization profile, and both Rust targets.
- Install dependencies with `npm ci`; Node 22+ and the supported Rust toolchain are needed.
- Authenticate the GitHub CLI locally with `gh auth login` if necessary, with write access to `rishitshivesh/portglass`. Do not copy a GitHub token into source or chat.
- Run `npm run release:doctor` to inspect tools, targets and certificate availability. It does not sign, upload or publish.

Your signing private key and Apple notarization credentials stay in Keychain. The binary is submitted to Apple's notary service, and signed downloads go to GitHub only when you run the upload/publish commands. Local hidden notarization receipts are not uploaded.

## Prepare the version and source

The first release can use the current `0.1.0`. For a subsequent version:

```sh
npm run release:version -- 0.2.0
npm run format
npm run release:verify -- v0.2.0
```

The bump synchronizes npm, Tauri, Cargo and both lockfiles, rejects drift/downgrades, and leaves dependency versions intact. The UI version comes from the same npm manifest. Update `CHANGELOG.md` and review product limits. The project source license remains unselected; this release setup does not choose one.

Commit and review the release source, normally on `main`, then create the tag locally. For the first release:

```sh
git tag -a v0.1.0 -m "Portglass 0.1.0"
```

Only stable `vX.Y.Z` tags are supported. The release build requires a clean worktree and HEAD to match that tag, so the manifest identifies the exact source used.

## Build locally

After exporting the signing identity/team/profile described in the Apple guide:

```sh
npm run release:local -- 0.1.0
```

The command runs Biome, rustfmt, frontend/release tests and native collector/singleton tests, builds both architectures with Tauri, and signs the app using the local certificate. It submits a temporary ZIP to Apple through the named Keychain profile, requires Accepted status and staples the app ticket.

It then creates ZIP, TAR.GZ and a drag-to-Applications DMG. The DMG is signed, submitted to Apple and stapled separately. App identity/version/minimum OS, both executable architectures, strict code signing, expected team, Gatekeeper assessment and stapled tickets are checked. Both archives are extracted and verified again. All three files are hashed before the manifest and SHA256SUMS are accepted.

Outputs go to ignored `release-assets/v0.1.0/`. Nothing is uploaded by this command. Existing release directories are not overwritten. Notarization uses the network and can take time; missing credentials, rejection or any verification failure stops the process with no unsigned fallback.

## Upload a GitHub draft

```sh
npm run release:upload -- 0.1.0
```

This revalidates all distributions, confirms the source manifest matches the local tag, verifies the origin repository, pushes that tag and creates/uploads a GitHub **draft**. It does not publish the release. Only the three downloads, SHA256SUMS and manifest are uploaded. No passwords, keys, receipts or cache data are included.

Review release notes and test the draft downloads on appropriate Macs/accounts. Build success does not prove behavior on every supported OS. Test both hardware architectures before claiming both were smoke-tested. Published downloads must never be silently replaced under the same version.

## Publish and synchronize Homebrew

When the draft is reviewed and ready:

```sh
npm run release:publish -- 0.1.0
```

This validates the local downloads and generated cask, publishes the draft as the latest stable GitHub Release and updates `Casks/portglass.rb` through GitHub's API using local CLI authentication. No Actions runner, GitHub signing secrets or cross-repository PAT is needed.

Homebrew uses the exact ZIP version and checksum. Cask updates reject drafts/prereleases, stale non-latest events, downgrades and same-version checksum replacement. The Contents API uses the existing file SHA for conflict detection and preserves unrelated files. If branch rules prohibit writing the cask, it fails rather than bypassing protection; commit the generated cask through a normal PR.

If you publish the reviewed draft through GitHub's web UI instead, or only cask synchronization needs retrying:

```sh
npm run release:cask -- 0.1.0
```

A network/branch-rule failure after GitHub publication may leave the release public while the cask is still pending. Correct the issue and retry cask synchronization; do not reupload or replace public archives.

After the cask is synchronized:

```sh
brew tap rishitshivesh/portglass https://github.com/rishitshivesh/portglass.git
brew install --cask rishitshivesh/portglass/portglass
```

This repository doubles as the custom tap. No second tap repository is required. It is separate from Homebrew's central cask repository. Before the first verified publication there is intentionally no placeholder `portglass.rb` or fake checksum.

## Recovery and manual verification

- **Doctor fails:** follow the Apple guide. The current machine needs a Developer ID Application identity and Intel Rust target.
- **Notarization rejected:** inspect the local hidden receipt and Apple's submission log. Do not publish. Correct the app and use a new reviewed source/version as appropriate.
- **Incomplete local attempt:** inspect it first. You may remove only that unpublished local `release-assets/vX.Y.Z` directory to retry. The helper never deletes it automatically.
- **Duplicate draft assets:** uploads do not use `--clobber`. Review/remove incomplete draft assets yourself before retrying. Public releases are not overwritten.
- **Cask branch update blocked:** use the generated `portglass.rb` through a normal PR or retry synchronization after addressing repository policy. Do not weaken policy just to bypass an error.
- **Bad public release:** ship a higher patch version; don't repoint an existing version URL or checksum.

Independent local verification/regeneration:

```sh
node scripts/release/artifact.mjs verify 0.1.0 release-assets/v0.1.0
node scripts/release/publish-cask.mjs v0.1.0 release-assets/v0.1.0
node scripts/release/check-cask.mjs release-assets/v0.1.0/portglass.rb
```

The cask checker creates a temporary local tap because Homebrew requires one, performs Ruby syntax and Homebrew style checks, then removes it. It does not install an app or persist a developer-mode preference.

## Upgrades and support

See [installation instructions](../installation.md). Quit the existing Portglass instance before upgrading so the next launch loads the new binary. The stable app identifier preserves same-user singleton/cache behavior. Use `brew upgrade --cask rishitshivesh/portglass/portglass` or a later signed GitHub download. No in-app updater is enabled.

References: [Apple Developer ID](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/), [Apple notarization](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow), [Homebrew taps](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap), [cask checksums](https://docs.brew.sh/Cask-Cookbook).
