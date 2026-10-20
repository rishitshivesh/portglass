import { invoke } from "@tauri-apps/api/core";
import type { DockerEndpoint, DockerUsage, StorageReport } from "./types";
export const scanStorage = () => invoke<StorageReport | null>("scan_storage");
export const cancelStorageScan = () => invoke<void>("cancel_storage_scan");
export const trashStorageResource = (
  resourceId: string,
  confirmation: string,
) => invoke<string>("trash_storage_resource", { resourceId, confirmation });
export const readDockerStorage = (endpointId: string) =>
  invoke<DockerUsage>("docker_storage", { endpointId });
export const discoverDocker = () =>
  invoke<DockerEndpoint[]>("docker_endpoints");
export const scanDeveloperLocations = () =>
  invoke<StorageReport>("system_storage");
export const refreshStorage = () => invoke<StorageReport>("refresh_storage");
export const cachedStorage = () =>
  invoke<StorageReport | null>("cached_storage");
export const clearStorageCache = () => invoke<void>("clear_storage_cache");
