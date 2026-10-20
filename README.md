# Portglass

Your development machine, under the glass. A macOS-first, observation-first Tauri 2 + React/TypeScript + Rust desktop application.

## Run

Requires Node 22+, npm, a stable Rust toolchain and Xcode Command Line Tools.

```sh
npm ci
npm run desktop
```

The launcher also discovers a stable Rust toolchain in `~/.rustup/toolchains` when Cargo shims are missing from PATH. In that case downloads are isolated to `.tooling/cargo`. It does not modify shell settings.

```sh
npm run build                  # Typecheck and build React
npm run format                 # Biome formatting, imports and safe fixes
npm run check                  # Biome CI check
npm run format:rust            # Rustfmt
npm run check:rust             # Rust formatting check
npm run test:frontend          # Snapshot lifecycle and selector tests
npm run test:core              # Rust parser/collector tests
npm run build:desktop          # Native executable, no installer/signing
```

The executable is `src-tauri/target/debug/portglass` for development and `src-tauri/target/release/portglass` for a release build. `npm run dev` is a browser UI preview and deliberately has no machine-access backend.

## Implemented slice

- Overview, TCP listeners, processes, detected agent processes and collector settings.
- Search by process, PID, port, address or agent; read-only resource inspector.
- Focus the owning macOS app from the inspector, including a verified parent terminal/editor where available. Exact window/tab/session selection is not supported.
- Agent cards distinguish process detection from activity and attention. Both remain unknown without a connected, authorized provider integration.
- macOS `ps` metadata and `lsof` TCP listening snapshots; IPv4 and IPv6 are distinct.
- One instance per macOS user across development, packaged and copied executables. Relaunching activates the existing window. Closing hides it; tray Open restores it and Quit exits.
- Storage with whole-folder totals and grouped summaries for build outputs, dependencies, caches and SDKs/simulators. Nested `.next/dist` contents remain inside the `.next` entry.
- Scan a selected root or common developer locations, including projects, package caches, Xcode builds, simulators and Android SDK storage. Partial coverage is explicit.
- Bounded local scan cache: four recent results, 15-minute reuse, observation timestamps, force rescan and clear-cache controls. Cached data cannot authorize cleanup.
- Dev Tools groups live memory RSS for IDEs, Xcode/Swift tooling, Android tools, language runtimes, local databases/services, agents and container hosts.
- Reviewed native Trash controls for eligible Node dependencies/Python environments, with typed confirmation, two-minute expiry and identity checks. No permanent-delete fallback or empty-Trash action.
- Discover local Docker-compatible sockets for Colima profiles, OrbStack, Docker Desktop, Rancher Desktop and Lima. Query a selected engine for image/container/volume/build-cache usage; object controls remain absent.
- Collection every 10 seconds while visible, pause toggle, manual refresh, per-collector switches and a 5-second backend cache.
- Exact executable-name signatures for Codex, Claude Code, Gemini CLI and OpenCode. These mean **detected process**, never a confirmed active session. Node-hosted agents may not be detected.

## Boundaries and limitations

Typed commands expose observations, on-demand foreground navigation and narrowly scoped storage operations. Focus requires a recent enabled process snapshot, revalidates process identity and same-user ancestry, and rechecks listener ownership when selected from a port. It uses AppKit to activate an existing application; it does not launch arbitrary executables or request Accessibility access. No arbitrary frontend shell/filesystem/network API, process controls, provider session files, command arguments, environment contents, persistent process/session observations or autostart. Folder selection is a native dialog; scans and cleanup authority stay in Rust. Each fixed system command has a 4-second deadline and 2 MB output limit. Collection runs on a worker and overlapping snapshot requests share a serialized cache. Collector errors are independent. Disabling a collector clears the displayed snapshot and replaces its backend cache on the next request; an already running bounded observation may finish and is discarded by the renderer.

Process identity includes PID, start time, UID and executable basename. This is suitable for read-only inspection; executable inode/boot identity and action-grade validation are not implemented. CPU is `ps` lifetime average, not sampled utilization. Memory is RSS; summed RSS can double count shared pages and is not system pressure. Socket ownership and process visibility are limited by OS permissions. There is no historical all-event capture or project attribution.

Docker object controls, Brew, Redis, provider metadata, a native quick panel, persistent timeline, machine pressure metrics, signing, installers and other OS adapters are deferred. This is an unsigned development slice, not a production release.

See [architecture and decisions](docs/decisions.md).

See [storage, application focus and agent-state scope](docs/expansion-scope.md) for storage controls, singleton behavior and the remaining opt-in provider integration work.

The frontend uses official shadcn/ui components with Base UI and Tailwind v4. Feature modules isolate collection lifecycle, selectors and views. See [engineering workflow](docs/engineering.md) for formatting, editor setup and module conventions.

## Singleton and storage checks

`node scripts/desktop.mjs test:core --bin portglass` verifies cold-start races and lock recovery. With the native app running, `node scripts/test-instance.mjs` launches eight concurrent secondary processes, including a copied executable. Each must reuse the owner and exit. `npm run desktop` also probes the owner before starting Vite; while an app is already running this activates it rather than rebuilding. Quit first when you need to load a new build.

Storage scan metadata and selected roots are cached locally in `~/Library/Caches/dev.portglass.desktop/storage-v1.json` (versioned JSON, at most four results and 8 MB). Cleanup authority and all process/agent snapshots stay in memory. There is no application database yet. The singleton keeps only a private user-owned lock file and activation socket under `/tmp/dev.portglass.desktop-<uid>`. All supported copies must retain the `dev.portglass.desktop` identity. A pre-singleton legacy build must be quit once before migration; it cannot participate in the lock protocol. This guarantee is per macOS user on one machine, not across machines or OSes.
