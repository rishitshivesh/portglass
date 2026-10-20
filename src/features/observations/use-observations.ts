import { useEffect, useState, useSyncExternalStore } from "react";
import { SnapshotController } from "./snapshot-controller";
import { desktopAvailable, fetchSnapshot } from "./transport";

export const REFRESH_INTERVAL_MS = 10_000;
export function useObservations() {
  const [controller] = useState(() => new SnapshotController(fetchSnapshot));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!desktopAvailable) return;
    controller.start();
    return () => controller.dispose();
  }, [controller]);

  useEffect(() => {
    if (!desktopAvailable || !autoRefresh) return;
    const observeIfVisible = () => { if (document.visibilityState === "visible") void controller.refresh(); };
    const timer = window.setInterval(observeIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", observeIfVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", observeIfVisible); };
  }, [controller, autoRefresh]);

  return { ...state, autoRefresh, setAutoRefresh, refresh: controller.refresh, setEnabled: (key: "processesEnabled" | "portsEnabled", enabled: boolean) => controller.setEnabled(key, enabled) };
}
