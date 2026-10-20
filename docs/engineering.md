# Engineering workflow

## Tooling

`npm run format` applies Biome's formatting, import organization and safe lint fixes. `npm run check` is a non-mutating CI check and treats warnings as failures. Biome owns JS/TS/TSX, JSON, CSS and HTML; generated build output, dependencies, lockfiles and downloaded tooling are excluded by an explicit include list. Tailwind v4 directives are enabled in the CSS parser.

`npm run format:rust` formats Rust modules recursively; `npm run check:rust` verifies them. A fresh toolchain needs `rustup component add rustfmt`. The launcher also supports the official, checksum-verified formatter in this checkout's ignored `.tooling/rustfmt` directory when the installed toolchain has no rustfmt component. It changes no global shell or toolchain settings.

`npm run format:docs` handles Markdown, YAML and editor metadata, which are outside this Biome configuration. Editor recommendations and format-on-save settings live under `.vscode`.

## Modules

- `src/app`: application composition and navigation definitions.
- `src/features/observations`: typed IPC transport, serialized snapshot controller, visible-window scheduling, pure selectors and read-only resource views.
- `src/features/overview`, `agents`, `collectors`: feature-specific presentation.
- `src/features/storage`: typed transport, operation state, grouped/paginated resource cards, native/system scans, cache state, local-engine discovery and reviewed cleanup Sheet.
- `src/features/dev-tools`: pure process attribution and grouped memory presentation.
- `src/components/ui`: official shadcn source, using Base UI primitives and Tailwind v4.
- `src/components/layout`: desktop layout; `src/lib`: shared formatting and utilities.
- Rust `models`, `collectors`, `parsers`, `agents`, `cache`: domain metadata, bounded commands, host collection, normalization, signatures and cache ownership.
- Rust `storage`: scanner, system-root policy, bounded persistent cache, cleanup authority and Docker-compatible runtime adapter; `storage_commands`: typed desktop IPC.
- Rust `instance`, `lifecycle`, `tray`: pre-runtime singleton authority, activation and window/tray behavior.
- Rust `commands`: observation/navigation IPC separate from collectors.

## Performance and lifecycle

Sorting, RSS totals and top-consumer selection are memoized per snapshot. Deferred search filters the prepared snapshot. The process table renders at most 50 rows at once; pagination is local and does not trigger a host collection. Listener deduplication uses a hash set instead of repeatedly scanning all previous rows.

The snapshot controller serializes calls and coalesces pending requests. Collector-setting changes clear displayed observations, invalidate previous responses and schedule the latest configuration as soon as a current request completes. Stale errors cannot replace current state. Disposal suppresses late publications. Polling is session-only, stops on cleanup, and refreshes only while the document is visible; resuming visibility requests a fresh snapshot.

The inspector records the timestamp alongside the selected resource, so a later background refresh cannot make old details look newly observed. shadcn's Sheet provides modal focus handling, keyboard dismissal and an accessible title/description.

## UI and quality boundaries

Styles use shared semantic tokens in `src/style.css`; shadcn variants own component appearance. Raw palette values belong only in the theme. Generated primitive lint exceptions are narrow and documented: explicit group roles preserve shadcn form composition; label forwarding cannot be statically inferred; pointer-to-input focus is a convenience alongside a directly tabbable input. Application accessibility checks remain enabled. Reduced-motion overrides intentionally take precedence over component animations.

CI runs Biome, rustfmt, frontend lifecycle tests, Rust collector tests and both frontend/native builds on macOS. The workflow must run remotely before CI itself can be described as verified.

## Storage and singleton verification

`npm run test:core` includes hard-link/nesting, omitted coverage, cancellation/limits, scan-ID isolation, expiry, target replacement and Docker estimate parsing. `node scripts/desktop.mjs test:core --bin portglass` covers a cold-start race between eight claimants, existing-owner activation and reacquisition after dropping the owner. Socket tests need local socket access. CI includes both test targets.

`node scripts/test-instance.mjs` is a manual integration check requiring an already running app. It launches the native executable and a temporary copy concurrently and requires all secondaries to exit. It does not terminate the owner. It intentionally is not a headless CI check. `npm run desktop` while an owner runs should activate it and return without starting Vite.

The expanded checks cover grouped outer build totals, contextual build markers, shared hard-link accounting across system roots, persistent-cache sanitization/clearing, Colima profile socket discovery/deduplication and conservative Dev Tools attribution. UI state restores cached metadata without initiating a machine scan; operation revisions prevent late cache responses from overwriting newer scan results. Cached results retain their own observation timestamp.
