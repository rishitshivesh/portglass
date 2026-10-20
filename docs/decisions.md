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
