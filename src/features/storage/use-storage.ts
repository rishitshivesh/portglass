import { useEffect, useRef, useState } from "react";
import { desktopAvailable } from "@/features/observations/transport";
import {
  cachedStorage,
  cancelStorageScan,
  clearStorageCache,
  discoverDocker,
  readDockerStorage,
  refreshStorage,
  scanDeveloperLocations,
  scanStorage,
  trashStorageResource,
} from "./transport";
import type { DockerEndpoint, DockerUsage, StorageReport } from "./types";
export function useStorage() {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [docker, setDocker] = useState<DockerUsage | null>(null);
  const [endpoints, setEndpoints] = useState<DockerEndpoint[]>([]);
  const [discovered, setDiscovered] = useState(false);
  const [busy, setBusy] = useState<
    "scan" | "trash" | "docker" | "cache" | null
  >(null);
  const gate = useRef(false);
  const revision = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!desktopAvailable) return;
    let active = true;
    const initial = revision.current;
    void cachedStorage()
      .then((cached) => {
        if (active && revision.current === initial && cached) setReport(cached);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function run(
    kind: NonNullable<typeof busy>,
    action: () => Promise<void>,
  ) {
    if (gate.current) return;
    gate.current = true;
    revision.current++;
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setError(String(error));
    } finally {
      gate.current = false;
      setBusy(null);
    }
  }
  return {
    report,
    docker,
    endpoints,
    discovered,
    busy,
    error,
    notice,
    scan: () =>
      run("scan", async () => {
        const result = await scanStorage();
        if (result) setReport(result);
      }),
    system: () =>
      run("scan", async () => setReport(await scanDeveloperLocations())),
    refresh: () => run("scan", async () => setReport(await refreshStorage())),
    clear: () =>
      run("cache", async () => {
        await clearStorageCache();
        setReport(null);
        setNotice(
          "Local scan cache cleared. Developer resources are unchanged.",
        );
      }),
    cancel: async () => {
      try {
        await cancelStorageScan();
      } catch (error) {
        setError(String(error));
      }
    },
    discover: () =>
      run("docker", async () => {
        setDocker(null);
        setEndpoints(await discoverDocker());
        setDiscovered(true);
      }),
    connectDocker: (id: string) =>
      run("docker", async () => {
        setDocker(null);
        setDocker(await readDockerStorage(id));
      }),
    trash: (id: string, confirmation: string) =>
      run("trash", async () => {
        const receipt = await trashStorageResource(id, confirmation);
        setReport(null);
        setNotice(receipt);
      }),
  };
}
