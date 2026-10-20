import { useMemo, useState } from "react";
import { ObservationAlert } from "@/components/observation-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMemory } from "@/lib/format";
import type { Process } from "@/types";
import { groupDevTools } from "./classify";
export function DevToolsView({
  processes,
  query,
  enabled,
  onInspect,
}: {
  processes: Process[];
  query: string;
  enabled: boolean;
  onInspect: (process: Process) => void;
}) {
  const groups = useMemo(() => groupDevTools(processes), [processes]);
  const [category, setCategory] = useState("All");
  const total = groups.reduce((sum, group) => sum + group.memoryMb, 0);
  const observed = processes.reduce(
    (sum, process) => sum + process.memoryMb,
    0,
  );
  const visible = groups.filter(
    (group) =>
      (category === "All" || group.category === category) &&
      `${group.name} ${group.category} ${group.processes.map((p) => `${p.name} ${p.pid}`).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  if (!enabled)
    return (
      <ObservationAlert title="Process collection is disabled">
        Enable process collection in Collectors to see developer tool memory.
      </ObservationAlert>
    );
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Dev tool memory (RSS)", formatMemory(total)],
          [
            "Share of observed RSS",
            observed ? `${((total / observed) * 100).toFixed(1)}%` : "—",
          ],
          ["Detected tool groups", String(groups.length)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Current resident memory from visible processes, grouped by executable
        names and same-user parent relationships. Shared pages can be counted
        more than once. This is neither unique physical RAM nor configured VM
        memory; remote/container-internal services are outside host process
        coverage. Generic Java is not assumed to be Android Studio or Gradle.
      </p>
      <nav className="flex flex-wrap gap-2" aria-label="Tool categories">
        {["All", ...new Set(groups.map((group) => group.category))].map(
          (name) => (
            <Button
              key={name}
              variant={name === category ? "secondary" : "outline"}
              size="sm"
              onClick={() => setCategory(name)}
            >
              {name}
            </Button>
          ),
        )}
      </nav>
      {visible.length === 0 && (
        <ObservationAlert title="No matching developer tools observed">
          Try another filter. Installed tools that are not running consume no
          observed process RSS here.
        </ObservationAlert>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((group) => (
          <Card key={group.name}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{group.name}</CardTitle>
                <Badge variant="outline">{group.category}</Badge>
              </div>
              <CardDescription>
                {formatMemory(group.memoryMb)} RSS · {group.processes.length}{" "}
                processes · {group.cpu.toFixed(1)}% summed lifetime CPU average
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.processes.slice(0, 6).map((process) => (
                <div
                  key={process.id}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onInspect(process)}
                    className="min-w-0 justify-start"
                  >
                    <span className="truncate">
                      {process.name} · {process.pid}
                    </span>
                  </Button>
                  <span className="shrink-0 text-muted-foreground">
                    {formatMemory(process.memoryMb)}
                  </span>
                </div>
              ))}
              {group.processes.length > 6 && (
                <p className="text-xs text-muted-foreground">
                  Largest 6 shown. Use Processes to inspect the remaining{" "}
                  {group.processes.length - 6}.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
