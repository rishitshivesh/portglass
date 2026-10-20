import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Snapshot } from "../../types.ts";
import type { CollectorSettings } from "./snapshot-controller.ts";

export const desktopAvailable = isTauri();
export async function fetchSnapshot(settings: CollectorSettings): Promise<Snapshot> {
  if (!desktopAvailable) throw new Error("Open the desktop app to collect a real snapshot.");
  return invoke<Snapshot>("snapshot", { ...settings });
}
