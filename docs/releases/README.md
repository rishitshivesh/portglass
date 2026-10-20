# Releases and Homebrew

Portglass ships as a signed, notarized universal macOS app, downloaded from GitHub Releases and installed directly or through a custom Homebrew cask. The minimum configured macOS version is 12.0; Apple Silicon and Intel binaries share one archive. The native runtime remains macOS-only.

**Current status:** release tooling is implemented, but no public release or installable cask exists yet. Apple signing/notarization secrets must be configured first. The project has no selected source license; this change does not invent one. Preserve all existing third-party notices.

## Repository and tap

The application repository doubles as the tap. No second repository, cross-repository token or external package-hosting service is required. After the first signed release is published and its Homebrew workflow succeeds:

```sh
brew tap rishitshivesh/portglass https://github.com/rishitshivesh/portglass.git
brew install --cask rishitshivesh/portglass/portglass
```

This is a custom tap, not a submission to Homebrew's central cask repository. `Casks/portglass.rb` is generated from real verified release bytes only; it is absent before that point. Do not create dummy checksums or use `sha256 :no_check`.

## One-time maintainer setup

In the GitHub repository, open Settings → Environments and create `release`. Add these environment secrets there, or configure repository secrets with the same names:

| Secret                       | Value                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `APPLE_CERTIFICATE`          | Base64 of an exported Developer ID Application `.p12`, including its private key |
| `APPLE_CERTIFICATE_PASSWORD` | Export password for that `.p12`                                                  |
| `APPLE_SIGNING_IDENTITY`     | Exact `Developer ID Application: … (TEAMID)` identity                            |
| `APPLE_ID`                   | Apple account email used for notarization                                        |
| `APPLE_PASSWORD`             | Apple **app-specific** password, not the normal account password                 |
| `APPLE_TEAM_ID`              | Ten-character Apple Developer team ID                                            |

Use your Apple Developer account and GitHub's secret entry UI. Do not paste keys/passwords into issues, chat, commits, release notes or logs. The pipeline does not create accounts, certificates or additional credentials. It fails before building when required secrets are absent. A free testing identity or ad-hoc signing is insufficient for this release policy. [Tauri signing and notarization guide](https://v2.tauri.app/distribute/sign/macos/)

Keep Actions enabled. CI has read-only repository access; the release and Homebrew publishing jobs request `contents: write` only for their own repository. Third-party Actions are pinned to inspected commit SHAs. The build validates that the tag is reachable from `main` before using signing secrets. Restrict who can push release tags using your repository's rules. Any optional environment review settings should reflect your maintenance process.

The Homebrew publisher writes only `Casks/portglass.rb` on the default branch through the Contents API, using the existing blob SHA for conflict detection. If branch rules prohibit this bot write, it fails rather than bypassing protection; a maintainer can commit the generated cask through a normal PR. No PAT is needed for the default setup. [GitHub token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)

## Prepare a release

The first release can use the current `0.1.0` version after its changes are merged and verified. Later versions use:

```sh
npm run release:version -- 0.2.0
npm run format
npm run release:verify -- v0.2.0
```

The version command updates the npm manifest and root lock entry, Tauri configuration, Cargo package and its Cargo.lock entry together. It refuses version drift and downgrades. The displayed UI version comes from the same npm manifest at build time. No npm package is published.

Update `CHANGELOG.md`, keep the supported platforms and minimum macOS version accurate, run CI and review outstanding limitations. Commit the version/changelog changes and merge them to `main` before tagging. Then, for example:

```sh
git tag -a v0.2.0 -m "Portglass 0.2.0"
git push origin v0.2.0
```

Only stable `vX.Y.Z` tags are supported. Prerelease syntax and branch refs are rejected. The Signed macOS release workflow also supports Run workflow with an existing stable tag for recovery.

## Build and draft

The workflow:

1. Checks out the exact tag and verifies ancestry plus all application/lockfile versions.
2. Requires the six Apple secrets, installs locked npm dependencies, and runs formatting, frontend/release tests and native tests.
3. Builds both macOS architectures with Rust 1.91.0 and Tauri's universal target, using the exported Developer ID certificate and notarization credentials.
4. Verifies bundle identity/version/minimum OS, both binary architectures, strict code signing, expected Apple team, Gatekeeper assessment and the stapled notarization ticket.
5. Creates a ZIP containing `Portglass.app`, SHA256SUMS and a versioned release manifest containing its SHA-256, byte size and source commit.
6. Creates a **draft** GitHub Release and uploads artifacts. It never automatically publishes the draft, overwrites a public release or enables in-app updates.

Release assets are:

```text
Portglass-X.Y.Z-universal-macos.zip
SHA256SUMS
release-manifest.json
```

The manifest's notarized flag is written only after the native checks pass; downstream Homebrew verification repeats the native checks after download. These checks establish distribution signatures and packaging, not product completeness or correctness on every supported OS.

## Review, publish and synchronize Homebrew

Wait for the build workflow to succeed. Download the draft ZIP to a clean test Mac/account and verify normal launching, singleton behavior, ports/processes, tool memory, storage coverage/cache and scoped controls. Check both architectures on real hardware before claiming both were smoke-tested. Include the known limits from `docs/expansion-scope.md` in the release notes.

Review generated notes and publish the draft in GitHub when ready. That human publication triggers Publish Homebrew cask. It downloads the versioned ZIP/manifest, verifies checksum, universal app identity, code signing, Gatekeeper and stapled ticket, generates the Ruby cask and checks Ruby syntax plus Homebrew style in a temporary local validation tap. It advances the default-branch cask only if this is GitHub's latest published stable release and no version downgrade or same-version checksum change is detected.

Draft/prerelease/manual unsigned uploads cannot update the tap. Token-created events may not trigger another workflow, so the Homebrew workflow also supports Run workflow with the latest stable tag. See [GitHub's event restrictions](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow).

When the cask workflow succeeds, test an install and upgrade through Homebrew before announcing availability. Published archives must not be replaced under the same tag. Corrections ship as a higher patch version.

## Recovery

- **Secrets missing:** configure the `release` environment secrets and rerun the workflow. No unsigned public fallback exists.
- **Build/notary failure:** read the failed job; don't publish its draft. Notarization can take time and runner access to Apple is required.
- **Duplicate draft assets on retry:** uploads intentionally do not use `--clobber`. Review/remove the incomplete draft or its draft assets before retrying. Never delete/replace public artifacts for the same version.
- **Cask bot blocked by branch rules:** generate the cask locally from the downloaded verified assets, then use the normal PR process. Do not weaken branch protections to bypass a failed update.
- **Delayed/older release event:** the publisher refuses to downgrade the tap. Trigger synchronization for the current latest stable release instead.
- **Bad published build:** ship a new patch release. Do not repoint a versioned URL or silently change a checksum. An older GitHub archive remains available for deliberate rollback.

For a manual cask regeneration, download the expected ZIP and manifest into a local directory, then run on macOS:

```sh
node scripts/release/artifact.mjs verify 0.2.0 /path/to/downloads
node scripts/release/publish-cask.mjs v0.2.0 /path/to/downloads
node scripts/release/check-cask.mjs /path/to/downloads/portglass.rb
```

This generates a cask without mutating GitHub. The workflow alone passes `--publish`. Do not run against unreviewed archives from arbitrary sources.

## Installation and upgrades

See [installation instructions](../installation.md). Homebrew owns the installed app; `brew upgrade --cask rishitshivesh/portglass/portglass` upgrades it. Quit the running older instance first so the next launch loads the updated executable. The stable app identifier is unchanged, preserving same-user singleton behavior and local cache location.

No Tauri in-app updater is enabled. Adding one would require a separate signed-update protocol/key and configuration review; GitHub release hosting does not itself create an automatic updater.

References: [Homebrew tap maintenance](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap), [cask format and checksums](https://docs.brew.sh/Cask-Cookbook), [Tauri macOS distribution](https://v2.tauri.app/distribute/macos-application-bundle/).
