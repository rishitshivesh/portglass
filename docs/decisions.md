# Implementation decisions

Source: [Portglass master PRD](https://app.notion.com/p/3ffbe8461e4181dda4bbdf6515bf5c44).

## ADR-001: retain the PRD stack (accepted)

The user approved Tauri 2, React/TypeScript and Rust, accepting build/setup time beyond the original 20-minute target. Electron was discussed and not selected. An existing stable Rust toolchain was subsequently discovered in `.rustup`; shell configuration is unchanged.

## ADR-002: snapshot IPC, read-only host adapter

React invokes one Rust command with two boolean collector switches. Rust runs fixed absolute executable paths and allowlisted arguments, without a shell and with an empty environment except `LC_ALL=C`. Command output is bounded to 2 MB and 4 seconds. The renderer receives no arbitrary command, path, socket, environment or subprocess interface. There is no production HTTP monitoring server.

The adapter is macOS-only and exposes explicit unsupported status elsewhere. PID/start/UID/basename identity and TCP/family/address/port/PID endpoint identity support inspection. Control actions are absent; no snapshot can authorize a termination.

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

Activity and attention remain explicitly unknown in the running product until an authorized provider event adapter is connected. A tested normalized status model handles fresh correlated provider evidence; CPU/idle heuristics cannot manufacture certainty. Official Claude hooks and Codex App Server docs establish feasible signal mechanisms but do not prove access to all independently running sessions. See `docs/expansion-scope.md` for the next integration phase and the earlier storage/cleanup requirement, which is planned rather than implemented.
