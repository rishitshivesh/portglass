import type { Snapshot, Process } from "../../types.ts";

const matches = (query: string, fields: (string | number | null)[]) => fields.some((value) => String(value ?? "").toLowerCase().includes(query));
const byMemory = (a: Process, b: Process) => b.memoryMb - a.memoryMb;
export function selectObservations(data: Snapshot | null, query: string) {
  const search = query.trim().toLowerCase();
  const sorted = [...(data?.processes ?? [])].sort(byMemory);
  const processes = search ? sorted.filter((p) => matches(search, [p.name, p.pid, p.uid, p.agent])) : sorted;
  const listeners = (data?.listeners ?? []).filter((p) => !search || matches(search, [p.name, p.pid, p.port, p.address]));
  const allAgents = sorted.filter((p) => p.agent);
  return { processes, listeners, agents: processes.filter((p) => p.agent), allAgents, top: sorted.slice(0, 5), totalMemoryMb: sorted.reduce((total, p) => total + p.memoryMb, 0) };
}
