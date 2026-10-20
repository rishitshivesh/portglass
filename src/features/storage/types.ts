export interface StorageResource {
  id: string;
  path: string;
  category: string;
  logicalBytes: number;
  allocatedBytes: number;
  complete: boolean;
  trashAllowed: boolean;
}
export interface StorageReport {
  root: string;
  roots: string[];
  capturedAt: number;
  cached: boolean;
  cacheNote: string | null;
  resources: StorageResource[];
  entries: number;
  skipped: number;
  errors: number;
  status: string;
  durationMs: number;
}
export interface DockerUsage {
  endpoint: string;
  rows: {
    category: string;
    total: string;
    active: string;
    size: string;
    reclaimable: string;
  }[];
}

export interface DockerEndpoint {
  id: string;
  name: string;
  socket: string;
}
