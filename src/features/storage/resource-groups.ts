import type { StorageResource } from "./types";
export type ResourceGroup =
  | "All"
  | "Build outputs"
  | "Dependencies"
  | "Caches"
  | "SDKs & simulators";
export const resourceGroups: ResourceGroup[] = [
  "All",
  "Build outputs",
  "Dependencies",
  "Caches",
  "SDKs & simulators",
];
export function resourceGroup(resource: StorageResource): ResourceGroup {
  if (
    resource.category.includes("build") ||
    resource.category === "Build output"
  )
    return "Build outputs";
  if (resource.category.includes("cache") || resource.category === "Rust cache")
    return "Caches";
  if (
    resource.category.includes("SDK") ||
    resource.category.includes("simulator")
  )
    return "SDKs & simulators";
  return "Dependencies";
}
export const formatBytes = (value: number) =>
  value >= 1024 ** 3
    ? `${(value / 1024 ** 3).toFixed(2)} GiB`
    : `${(value / 1024 ** 2).toFixed(2)} MiB`;
