Portglass is a macOS developer-resource inspector. This universal app supports Apple Silicon and Intel and requires macOS 12 or later.

This release includes process/port visibility, developer-tool memory groups, scoped storage scans and cache, local Docker-compatible engine discovery, application focus and single-instance behavior. Review the release's changelog and known limitations before publishing.

Agent process discovery does not establish live activity or attention state. Storage and RSS have explicit coverage/accounting limits. Process/session observations remain local and memory-only; only storage scan metadata is cached. Cleanup requires a fresh eligible scan and confirmation. No automatic approvals, process termination or Docker prune/volume deletion is included.

Download the universal macOS ZIP, move Portglass.app to Applications and open it. For Homebrew, use the installation instructions after the cask synchronization workflow succeeds. Quit a running older copy before upgrading so the next launch loads the new binary.

The release pipeline requires Developer ID signing, notarization and a stapled ticket. SHA256SUMS and release-manifest.json accompany the application archive. No in-app updater is enabled; use Homebrew upgrades or a later signed GitHub Release.
