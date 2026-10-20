# Portglass engineering conventions

- Keep the PRD's Tauri + React/TypeScript + Rust architecture and read-only boundaries. Sensitive collectors and control actions require a separate scoped implementation and review.
- Organize frontend code by feature under `src/features`; keep app composition in `src/app`, reusable UI in `src/components`, and pure utilities in `src/lib`. Keep IPC transport and collection lifecycle outside visual components.
- Use the official shadcn components in `src/components/ui` for React controls, surfaces and overlays. Compose their variants and semantic theme tokens rather than introducing duplicate controls or component-specific color overrides.
- Use direct module imports. Keep the entrypoint small, inputs typed, and resource provenance explicit.
- Use Biome for TypeScript, TSX, JavaScript, JSON, CSS and HTML: `npm run format` and `npm run check`. Use `npm run format:rust` / `npm run check:rust` for Rust. Prettier is limited to Markdown/YAML/editor metadata via `npm run format:docs`.
- Keep expensive derived calculations tied to snapshot changes, bound rendered row counts, serialize collection, reject stale responses, and clean up timers/subscriptions. Measure before adding speculative optimizations.
- Validate relevant changes with `npm run test:frontend`, `npm run test:core`, `npm run build`, and a native build when IPC or desktop behavior changes. Preserve the safety/fault-injection tests.
- Update architecture decisions and verification evidence in `docs/decisions.md`; maintain the linked Notion implementation record for meaningful scope or architecture changes.
