# Implementation decisions

Source: [Portglass master PRD](https://app.notion.com/p/3ffbe8461e4181dda4bbdf6515bf5c44).

## ADR-001: retain the PRD stack (accepted)

The user approved Tauri 2, React/TypeScript and Rust, accepting build/setup time beyond the original 20-minute target. Electron was discussed and not selected. An existing stable Rust toolchain was subsequently discovered in `.rustup`; shell configuration is unchanged.

## ADR-002: snapshot IPC, read-only host adapter

The initial observation adapter invokes a Rust snapshot command with two boolean collector switches. Subsequent typed commands are documented below. Rust runs fixed absolute executable paths and allowlisted arguments, without a shell and with an empty environment except `LC_ALL=C`. Command output is bounded to 2 MB and 4 seconds. The renderer receives no arbitrary command, socket, environment or subprocess interface. Folder paths displayed by Storage originate in a native user selection, not frontend authority. There is no production HTTP monitoring server.

The adapter is macOS-only and exposes explicit unsupported status elsewhere. PID/start/UID/basename identity and TCP/family/address/port/PID endpoint identity support inspection. No process termination is exposed; snapshot evidence cannot authorize one.

## ADR-003: evidence before session claims

Agent discovery uses exact executable basenames. Activity, model, project and provider session identity remain unverified/not observed. Local model servers and editor processes are not counted as coding sessions. Sensitive provider metadata is deferred.

## ADR-004: no storage for the initial slice

Snapshots are held in memory. A five-second backend cache serializes collectors. UI refresh occurs every ten seconds while visible and can be paused. Heavy integrations and history require later consent/retention work. Settings are intentionally session-only in v0.1.

## Verification gates

Parser fixtures cover process identity, PID restart distinction, basename-only output, agent signatures, IPv4/IPv6 endpoints, malformed records, deduplication and disabled collection. Native compilation and a real-machine smoke must pass before claiming a runnable desktop slice. No performance, signing or action safety gate is satisfied merely by compilation.

## ADR-005: modular components, shadcn and Biome (accepted)

The user requested Biome, modular code and shadcn whenever React is used. The frontend now separates IPC transport, request lifecycle, selectors, layout and feature views. Official shadcn/Base UI controls and Tailwind v4 semantic tokens replace hand-built controls and the inspector overlay. The process table renders 50 rows per page; snapshot-derived sorting and totals are memoized independently of search.

Biome owns supported frontend/config formatting, import organization and recommended lint checks. Rustfmt owns Rust; Prettier is restricted to Markdown/YAML and editor metadata. CI checks all applicable languages. Repository instructions preserve these conventions for future work.

The controller also fixes stale in-flight results/errors after collector-setting changes, queues the latest settings immediately and suppresses late responses after disposal. The inspector preserves each selection's actual observation timestamp. Rust listener deduplication now uses a hash set; collectors, parsers, models, cache, commands and tray setup are separate modules. These changes preserve the existing read-only scope.

## ADR-006: verified foreground navigation and provider-backed attention

The user requested focusing an application's window and understanding agent state/attention. Implemented an on-demand AppKit activation request through verified, same-user process ancestry; this navigates to an existing application without arbitrary launch capabilities or Accessibility. Port-origin navigation also rechecks listener ownership. Exact tab/session focus is unsupported.

Activity and attention remain explicitly unknown in the running product until an authorized provider event adapter is connected. A tested normalized status model handles fresh correlated provider evidence; CPU/idle heuristics cannot manufacture certainty. Official Claude hooks and Codex App Server docs establish feasible signal mechanisms but do not prove access to all independently running sessions. See `docs/expansion-scope.md` for the next integration phase and storage implementation boundaries.

## ADR-007: one owner per macOS user and app identity

Retain a kernel advisory lock for the full application lifetime, before Tauri initializes. Private local Unix IPC accepts activation only; secondary launches exit without creating collectors/windows. Fail closed on authority errors. A synchronous socket bind plus the kernel lock prevents cold-start races; the official plugin was not retained after source review found asynchronous binding and fail-open branches. Closing hides the existing window, and explicit Quit exits. The dev launcher probes the owner before starting Vite. See the singleton section in `docs/expansion-scope.md` for scope, crash recovery and legacy migration.

## ADR-008: selected-root storage with reviewed native Trash

The user expanded scope from observation to developer storage and controls. Metadata-only, bounded, cancellable scans run only after a native folder selection. Resource boundaries prevent nested double counting; hard links are deduplicated and logical versus allocated bytes remain separate. Process/session observations and all action authority remain in memory; bounded storage metadata caching is described in ADR-009. This supersedes the initial no-controls scope for the narrowly described cleanup operations only.

Cleanup accepts scan-specific IDs, expires after two minutes, requires a typed basename, serializes against scans and revalidates target/ancestor identity. Native macOS Trash is used explicitly through NSFileManager; no permanent-delete fallback, shell, automation permission or empty-Trash operation. Partial scans, caches, ambiguous build directories and selected roots cannot be trashed. Active-use and dependency-impact detection are still unavailable, and the path-based OS API is not atomic against concurrent path mutation.

Docker usage is an explicit, local-only `system df` observation with empty environment/config, fixed executable/arguments and bounded output. Docker estimates remain separate from filesystem sizes. Object controls and remote endpoints are deferred.

## ADR-009: whole-folder storage summaries, bounded cache and developer footprint

The user clarified that nested build files should be represented by one outer folder total, asked for a more intuitive cached system-scan workflow, local Docker alternatives and Dev Tools memory. Build outputs are grouped by outer resource with contextual manifest markers instead of exposing generic nested build directories. Storage summaries separate build outputs, dependencies, caches and SDK/simulator storage; only 24 resource cards render per page.

An explicit common-developer-locations scan shares one deadline/entry budget and hard-link identity set across nonoverlapping roots. Versioned JSON is sufficient for four local scan results, bounded to 8 MB, using private permissions and atomic replacement. Results have timestamps, cached/fresh status, 15-minute reuse, forced rescan and clearing. Cached IDs are distinct from live action authority and cannot authorize cleanup. This supersedes ADR-004 only for local storage metadata; there is no process/session history or automatic scan scheduler.

Container discovery supports multiple local Docker-compatible socket layouts without changing the user's active context or depending on Docker Desktop. Each usage request requires a discovered endpoint ID; remote URLs remain unavailable. Dev Tools derives one-count-per-process groups from metadata and bounded same-user ancestry, labels generic runtimes conservatively and presents RSS limitations explicitly.

## ADR-010: signed direct downloads, GitHub Releases and Homebrew

The user requested Homebrew distribution, GitHub-hosted releases and documentation, and explicitly required signing before public distribution. Stable versions synchronize npm/Tauri/Cargo and lockfiles; the displayed UI version comes from the same manifest. Universal macOS builds retain the stable app identity and configure macOS 12 as minimum. No placeholder cask, unsigned public fallback or in-app updater is introduced.

The application repository is also a custom tap, accessed with an explicit Git URL. Versioned artifacts and exact hashes generate the cask; guards reject prereleases, non-latest events, downgrades and checksum replacement. Published artifacts are never overwritten. Initial Actions-based automation was superseded by ADR-011 when the user said workflows cannot run.

## ADR-011: local signing and multi-format publication

Build/sign/notarize on the maintainer's Mac, using a local Developer ID Application identity and a named Keychain notarization profile. GitHub holds public downloads but receives no Apple private keys or signing secrets. The local helper requires clean tagged source, runs quality/native tests, builds universal, notarizes/staples the app, creates ZIP/TAR.GZ plus a drag-to-Applications DMG, notarizes/staples that DMG, and verifies all hashes and extracted signatures before upload.

Local commands upload a GitHub draft, let the maintainer review, then publish and synchronize the cask via local gh authentication. There are no automatic release workflows or tag-triggered jobs; the remaining CI workflow is manual-only. The v2 release manifest covers all three formats. Signing identity and Intel Rust support are currently missing locally, so no signed public release has been produced. See docs/releases/apple-signing.md and the local runbook for setup and recovery. The source license remains unselected.
