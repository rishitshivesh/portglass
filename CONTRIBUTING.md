# Contributing

Start with `README.md`, repository `AGENTS.md`, `docs/engineering.md` and `docs/expansion-scope.md`. Keep the supported macOS scope and existing privacy/control boundaries explicit.

```sh
npm ci
npm run check
npm run check:rust
npm run test:frontend
npm run test:release
node scripts/desktop.mjs test:core --lib --bin portglass
npm run build
```

Native tests need local TCP/Unix socket access. Rust 1.91.0 and Node 22 are the release baseline. Native application changes also require a macOS build and appropriate desktop verification. Record blocked/untested behavior rather than treating compilation as an end-to-end test.

Use feature modules, checked-in shadcn primitives, semantic theme tokens and bounded collectors. Preserve scan-ID authority, cleanup confirmation/expiry, cache sanitization and same-user instance ownership. Do not add generic shell/path execution or infer agent activity from CPU.

Release/distribution changes must keep published archives immutable, refuse unsigned public fallback, keep manifests/lockfile versions consistent and use actual artifact hashes. See `docs/releases/README.md`; publishing credentials belong only in GitHub secrets.

Do not include credentials, transcripts, process command arguments or private project paths in public reports. Share minimal reproducible fixtures and redact screenshots/logs before posting. A project source license has not yet been selected.
