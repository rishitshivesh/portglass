export interface Process {
  id: string;
  pid: number;
  parent: number;
  uid: string;
  started: string;
  name: string;
  cpu: number;
  memoryMb: number;
  agent: string | null;
}
export interface Listener {
  id: string;
  pid: number;
  name: string;
  uid: string;
  family: string;
  address: string;
  port: number;
}
export interface Capability {
  name: string;
  state: string;
  detail: string;
}
export interface Snapshot {
  capturedAt: number;
  processes: Process[];
  listeners: Listener[];
  capabilities: Capability[];
  platform: string;
  durationMs: number;
}
