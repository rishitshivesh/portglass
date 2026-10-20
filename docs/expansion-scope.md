# Storage, application focus and agent attention

## Storage and controls — implemented first slice

Storage uses an explicitly selected native folder, metadata-only traversal and bounded local caching. Recognized categories are `node_modules`, Python `venv`/`.venv` with a `pyvenv.cfg` marker, `site-packages`, project `target`/`dist`/`build`/`.next` outputs, npm/pnpm caches, selected Python caches and Cargo registry caches, Xcode DerivedData/Archives, simulators, Android SDK storage and JetBrains caches. Names and nearby manifest existence are evidence of a category, not proof of project ownership or safety. Generic `build`/`dist` require a project marker; Cargo `target` requires `Cargo.toml`. Markers are statted, not read. Nested recognized resources belong to the outer resource to avoid overlapping totals.

Scans run in a serialized worker, with a 30-second cooperative deadline, 250,000-entry/queued-path budget and 48-level depth bound. Cancellation is cooperative: a filesystem call stalled by macOS can delay it. Symlinks, other devices and sensitive directories such as `.ssh`, `.aws`, `.git`, provider directories and nested `Library` are skipped. Unreadable/omitted entries and limit/cancellation outcomes are visible. Incomplete resource subtrees are partial and cleanup is disabled for those resources. Skipped unrelated directories outside a resource do not invalidate its coverage. Symlink metadata is counted without following targets; intentional no-follow behavior does not make a resource partial. Cancellation or a scan-wide budget limit disables all cleanup for that result.

Logical file bytes and allocated filesystem blocks are distinct. Each device/inode is counted once per scan, including hard links shared across resources and allocated blocks for symlinks themselves; traversal order can assign a shared inode to either resource. APFS clones/compression, shared package stores and caches mean allocated bytes are not guaranteed reclaimable host space. No file contents, manifests, transcripts or credentials are read, and ownership/active use remain unknown.

### Reviewed cleanup

Only nested, fully scanned `node_modules` and identified Python virtual environments are eligible. The selected root itself, possible build outputs, shared caches, Python package directories and partial scans are observe-only. The review Sheet shows the exact path, explains unknown active use and dependency/local-modification impact, and requires the directory name to be typed.

Rust accepts a scan-specific resource ID and confirmation rather than an arbitrary path. Authority expires after two minutes and is replaced by the next scan. A single storage-operation gate prevents scan/cleanup overlap. Directory device/inode/owner/change timestamp and all ancestor device/inode identities are revalidated; symlink/replacement changes are rejected. Native `NSFileManager` moves the directory to macOS Trash, with no shell, Finder automation permission or permanent-delete fallback. It checks that the old path is absent and invalidates authority after success. Drag the resource out of Finder’s Trash to restore it; macOS may not provide Put Back for this API. Trash is never emptied by Portglass, so moving something there does not immediately reclaim disk space.

This path-based native Trash API is not an atomic filesystem snapshot or protection against a malicious concurrent same-user path swap. Stop workloads using the directory first. Directory timestamps also cannot prove every descendant stayed unchanged. The app exposes these as reviewed local controls, not a general deletion service. Broad cleanup, process termination, dependency-impact discovery and guaranteed byte reclamation are not implemented.

### System scanning and cache

The primary Scan developer locations action enumerates known user locations: Projects, Developer, package-manager caches, Xcode DerivedData/Archives, CoreSimulator, Android SDK and selected IDE caches. It is an explicit scan of common developer locations, not an assertion of full-system coverage. Use Choose scan root for arbitrary disks/projects. Canonical overlapping roots are deduplicated; a shared device/inode set prevents hard-link duplication across roots. A shared 30-second/250,000-entry budget applies across the whole request. Smaller shared locations are visited before Projects. The UI lists requested roots and distinguishes limits/errors from complete resource coverage.

The cache stores at most four recent folder/system results in versioned JSON at the Tauri app-cache location, normally `~/Library/Caches/dev.portglass.desktop/storage-v1.json`. The file is capped at 8 MB, directory/file permissions are 0700/0600, writes use a temporary file plus atomic rename and flush, and malformed/oversized caches are ignored. This small bounded document cache does not need a database. No content, credentials, process snapshots or agent activity history are persisted. Paths and storage metadata are local personal data; Clear scan cache removes this file and cached entries without touching developer resources.

Choosing a recently scanned scope reuses results for up to 15 minutes; Rescan now bypasses this cache. The last result can be restored after a restart regardless of age, with its original observation time and Cached label. Bounded/partial results keep their coverage status. This is TTL caching, not a filesystem watcher or proof of unchanged descendants. Cancelled results are not persisted. Cached resource IDs have a separate namespace, action flags are removed, backend cleanup authority is cleared, and a fresh scan is required before cleanup. Successful cleanup invalidates scan cache.

### Docker-compatible local runtimes

Find local engines discovers supported local Unix sockets for Colima profiles (up to 32), OrbStack, Docker Desktop, Rancher Desktop, Lima and the default local socket. Socket device/inode identity deduplicates aliases. Discovery inspects socket metadata only; it does not connect. The user selects an engine before `system df` is invoked. Frontend IDs are resolved again against discovered local endpoints; caller-provided socket URLs, environment contexts and remote hosts are not accepted.

The Docker CLI is resolved from fixed Homebrew, Docker application or user Docker binary locations. The command uses `--config /var/empty --host <verified local socket> system df --format '{{json .}}'` with an empty environment and the shared 4-second/2-MB bounds. Runtime/config changes are not performed, and credentials/context configs are not read. Socket existence does not prove the daemon is healthy; failures surface clearly. Custom socket layouts, rootless variants outside these locations and non-Docker protocols need further adapters.

Images, containers, local volumes and build cache retain the engine's reported size/reclaimable strings; they are not added to filesystem totals. No prune, volume deletion or container controls exist. Unattached volumes can contain valuable databases, and Docker object deletion need not shrink the host VM disk immediately. A live daemon usage query has not yet been validated on this machine; discovery and deduplication are fixture-tested.

Primary runtime references: [Colima socket FAQ](https://colima.run/docs/faq/), [OrbStack Docker/socket docs](https://docs.orbstack.dev/docker/), [Docker macOS socket locations](https://docs.docker.com/desktop/setup/install/mac-permission-requirements/).

## Dev Tools — live host process footprint

Dev Tools uses the existing process snapshot and adds no new collector or permission. It groups known executable signatures for IDEs, Xcode/Swift tools, Apple simulators, Android Studio/SDK tools, Redis/PostgreSQL/MySQL/MongoDB, coding agents, language runtimes, container hosts and virtual-machine processes. Each PID contributes to one group. Generic runtimes and unnamed helpers can be attributed through bounded, same-user parent relationships from the same snapshot; explicit service signatures remain their own group even when launched by an IDE. Generic Java remains unassigned when Android/Gradle ownership is not evidenced.

The UI shows grouped RSS, observed-RSS share, process counts, summed lifetime CPU average and the largest six processes with inspector/focus access. Categories and search narrow the view. RSS can overlap shared pages, is not unique physical memory or pressure, and does not measure configured VM RAM or container-internal services independently. Names/ancestry are evidence-based heuristics rather than exhaustive installation inventory. Installed but stopped tools have no observed RSS. No tool process history is persisted.

## Single instance — implemented on macOS

One kernel-held `flock` is acquired before Tauri, webviews, tray or collectors start. The scope is the stable application identity and numeric macOS user, independent of install/copy path or development/release mode. A private `0700`, user-owned directory under `/tmp` holds the `0600` lock and a synchronous Unix activation listener. Invalid permissions, symlinks and lock/listener failures stop startup rather than allowing a duplicate.

A secondary process connects only to request activation and exits. The socket has no command, argument or path payload. The owner unminimizes/shows/focuses its existing main window. Closing hides it; tray Open, Dock reopen and later launches restore it. Explicit Quit ends the process. The kernel releases the lock after normal exit or crash; only a new lock owner removes a stale socket. Lock-file presence alone never means an app is running. The dev launcher probes the built binary before starting Vite, preventing a second dev server on the normal relaunch path.

The official Tauri single-instance plugin was evaluated and not retained: its macOS implementation binds asynchronously and allows startup on several notification/listen errors, which does not enforce the required no-duplicate invariant. The small native authority instead fails closed. Same-user processes are inside the trust boundary; the private directory is not a defense against malicious code already running as that user. Legacy versions without this protocol require a one-time Quit. Other OS and cross-machine behavior are unsupported.

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
