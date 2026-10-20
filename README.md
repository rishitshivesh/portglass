# Portglass

Your development machine, under the glass. A macOS-first, read-only Tauri 2 + React/TypeScript + Rust desktop application.

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
- Tray menu opens the control center and quits the app.
- Collection every 10 seconds while visible, pause toggle, manual refresh, per-collector switches and a 5-second backend cache.
- Exact executable-name signatures for Codex, Claude Code, Gemini CLI and OpenCode. These mean **detected process**, never a confirmed active session. Node-hosted agents may not be detected.

## Boundaries and limitations

Typed commands expose snapshots and on-demand foreground navigation only. Focus requires a recent enabled process snapshot, revalidates process identity and same-user ancestry, and rechecks listener ownership when selected from a port. It uses AppKit to activate an existing application; it does not launch arbitrary executables or request Accessibility access. No shell/file/network plugin, process controls, provider session files, command arguments, environment contents, persistent observations or autostart. Each fixed system command has a 4-second deadline and 2 MB output limit. Collection runs on a worker and overlapping snapshot requests share a serialized cache. Collector errors are independent. Disabling a collector clears the displayed snapshot and replaces its backend cache on the next request; an already running bounded observation may finish and is discarded by the renderer.

Process identity includes PID, start time, UID and executable basename. This is suitable for read-only inspection; executable inode/boot identity and action-grade validation are not implemented. CPU is `ps` lifetime average, not sampled utilization. Memory is RSS; summed RSS can double count shared pages and is not system pressure. Socket ownership and process visibility are limited by OS permissions. There is no historical all-event capture or project attribution.

Docker, Brew, Redis, provider metadata, a native quick panel, persistent timeline, machine pressure metrics, signing, installers and other OS adapters are deferred. This is an unsigned development slice, not a production release.

See [architecture and decisions](docs/decisions.md).

See [storage, application focus and agent-state scope](docs/expansion-scope.md) for implemented navigation and the planned storage/cleanup and opt-in provider integration work.

The frontend uses official shadcn/ui components with Base UI and Tailwind v4. Feature modules isolate collection lifecycle, selectors and views. See [engineering workflow](docs/engineering.md) for formatting, editor setup and module conventions.
