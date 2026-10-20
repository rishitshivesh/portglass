import type { Snapshot } from "../../types.ts";

export interface CollectorSettings { processesEnabled: boolean; portsEnabled: boolean }
export interface SnapshotState { data: Snapshot | null; error: string; loading: boolean; settings: CollectorSettings }
export type SnapshotTransport = (settings: CollectorSettings) => Promise<Snapshot>;

/** Serializes requests and discards responses from revoked settings or an unmounted app. */
export class SnapshotController {
  private state: SnapshotState = { data: null, error: "", loading: false, settings: { processesEnabled: true, portsEnabled: true } };
  private listeners = new Set<() => void>();
  private revision = 0;
  private running = false;
  private queued = false;
  private active = true;
  private readonly transport: SnapshotTransport;

  constructor(transport: SnapshotTransport) { this.transport = transport; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<SnapshotState>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  start() { this.active = true; void this.refresh(); }
  dispose() { this.active = false; this.revision++; this.queued = false; }

  setEnabled(key: keyof CollectorSettings, enabled: boolean) {
    if (this.state.settings[key] === enabled) return;
    this.revision++;
    this.publish({ data: null, error: "", settings: { ...this.state.settings, [key]: enabled } });
    if (this.running) this.queued = true;
    else void this.refresh();
  }

  refresh = async () => {
    if (!this.active) return;
    if (this.running) { this.queued = true; return; }
    this.running = true;
    this.queued = false;
    const revision = this.revision;
    this.publish({ loading: true });
    try {
      const data = await this.transport({ ...this.state.settings });
      if (this.active && revision === this.revision) this.publish({ data, error: "" });
    } catch (error) {
      if (this.active && revision === this.revision) this.publish({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      this.running = false;
      if (this.active) {
        this.publish({ loading: false });
        if (this.queued) void this.refresh();
      }
    }
  };
}
