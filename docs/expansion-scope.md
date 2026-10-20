# Storage, application focus and agent attention

## Storage and control requirement — planned

The requested Storage surface should attribute developer disk usage to projects and tooling: `node_modules`, Python environments, package caches, build artifacts, Docker images, containers, build cache and volumes. Project drill-down should show evidence, scan location, ownership, observed time and candidate cleanup actions.

Scans are manually requested within selected roots. Report logical size, allocated disk usage and estimated reclaimable bytes separately when measurable. Shared caches, hard links, symlinks, Docker layers and Docker Desktop's virtual disk can make totals overlap. Do not promise reclaimed host disk bytes merely because Docker reports deleted objects. Bound scan depth/time/concurrency, avoid symlink traversal outside allowed roots and support cancellation.

Cleanup is a separate implementation phase, not an existing feature. Every operation needs an exact target, owning project/tool, dependency impact, estimated reclaimed space, warnings about persistent data, confirmation, revalidation and postcondition checks. Prefer package-manager/Docker-native commands with fixed arguments. Never introduce arbitrary shell execution or broad automatic pruning. Docker volumes may contain databases; an unattached volume is not necessarily safe to remove. Current deletion and process controls remain absent.

## Application focus — implemented on macOS

The resource inspector can request foreground activation of the owning application. Rust obtains the expected process from the recent snapshot, checks a fresh PID/start/UID/basename identity, validates listener ownership when applicable and traverses unchanged same-user ancestry. Parent traversal is bounded and cannot cross a changed identity or user. AppKit selects the nearest regular application in that chain.

No arbitrary application path, executable, bundle ID or raw PID is accepted as frontend authority. No AppleScript, Accessibility, screen recording, terminal keystrokes or shell bridge is used. The UI reports an activation request; macOS may decline it. Exact terminal/editor tab or agent-session selection is unavailable. Detached CLI sessions or severed ancestry can have no resolvable application.

## Agent activity and attention — explicit unknown now, provider connections planned

Process detection proves only that a matching executable was observed. High/low CPU, RSS or a long-running process cannot establish working, idle, awaiting approval or needing input. Current cards explicitly show state unknown and attention not observed. No event connector or global hook is installed.

The normalized status model supports working, awaiting approval, awaiting input, idle, turn complete, error and ended. Provider evidence must match a stable process identity and session ID and carry observed/expiry timestamps. Stale, future or mismatched evidence returns unknown; unknown attention is never shown as no attention. Turn completion must not imply the whole requested task completed. This model is tested with fixtures; it is not a live integration.

### Supported signal mechanisms

Claude Code documents lifecycle, permission and user-input hooks. An opt-in adapter can normalize allowlisted metadata from `PermissionRequest`, `Notification` types such as `agent_needs_input` or `permission_prompt`, `Stop` and session end events. `idle_prompt` is a delayed idle notification and must not be treated as an approval request. Hook payloads can include sensitive content, so the bridge must discard content fields and pass only reviewed metadata. Installing a hook requires an exact configuration preview, bounded nonblocking behavior and rollback. [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)

Codex App Server documents runtime status changes, active flags such as waiting on approval, server approval/input requests, request resolution and turn completion. A supported connection can normalize these into activity and attention without surfacing prompt/tool content. The documented runtime covers loaded/subscribed threads; launching a separate server is not evidence that it observes every independently running Codex CLI or desktop session. External-session coverage and version compatibility require a real supported integration before live status can be claimed. [Codex App Server reference](https://developers.openai.com/codex/app-server/)

### Proposed UI

Each session should show state, attention reason, source, confidence/coverage and last observed time, plus Focus application. An attention view should prioritize explicit unresolved approval/input requests and errors. Resolution must be correlated to the right request/session; resolving one request cannot clear unrelated outstanding requests. Revoking an integration stops collection and removes its status evidence. No automatic approvals or sending responses are included.
