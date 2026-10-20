import type { Process, Snapshot } from "../../types.ts";

const matches = (query: string, fields: (string | number | null)[]) =>
  fields.some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(query),
  );
const byMemory = (a: Process, b: Process) => b.memoryMb - a.memoryMb;
export function deriveSnapshot(data: Snapshot | null) {
  const sorted = [...(data?.processes ?? [])].sort(byMemory);
  const allAgents = sorted.filter((p) => p.agent);
  return {
    processes: sorted,
    listeners: data?.listeners ?? [],
    allAgents,
    top: sorted.slice(0, 5),
    totalMemoryMb: sorted.reduce((total, p) => total + p.memoryMb, 0),
  };
}
export function filterObservations(
  derived: ReturnType<typeof deriveSnapshot>,
  query: string,
) {
  const search = query.trim().toLowerCase();
  const processes = search
    ? derived.processes.filter((p) =>
        matches(search, [p.name, p.pid, p.uid, p.agent]),
      )
    : derived.processes;
  const listeners = search
    ? derived.listeners.filter((p) =>
        matches(search, [p.name, p.pid, p.port, p.address]),
      )
    : derived.listeners;
  return {
    processes,
    listeners,
    agents: search ? processes.filter((p) => p.agent) : derived.allAgents,
  };
}
