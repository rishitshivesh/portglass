import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowUpRight,
  Network,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { ObservationEmpty } from "@/components/observation-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AgentCard } from "@/features/agents/agent-card";
import { PortsTable } from "@/features/observations/components/ports-table";
import { formatMemory } from "@/lib/format";
import type { Listener, Process, Snapshot } from "@/types";

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardAction>
          <Icon className="size-4 text-primary" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-medium tracking-tight tabular-nums">
          {value}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
interface OverviewProps {
  data: Snapshot | null;
  listeners: Listener[];
  agents: Process[];
  top: Process[];
  totalMemoryMb: number;
  portsEnabled: boolean;
  onInspect: (resource: Listener | Process) => void;
  onPorts: () => void;
  onAgents: () => void;
}
export function OverviewView({
  data,
  listeners,
  agents,
  top,
  totalMemoryMb,
  portsEnabled,
  onInspect,
  onPorts,
  onAgents,
}: OverviewProps) {
  return (
    <>
      <section
        aria-label="Snapshot summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric
          icon={Network}
          label="TCP listeners"
          value={data ? String(data.listeners.length) : "—"}
          detail="Visible listening endpoints"
        />
        <Metric
          icon={Terminal}
          label="Processes"
          value={data ? String(data.processes.length) : "—"}
          detail="Observed process identities"
        />
        <Metric
          icon={Sparkles}
          label="AI agent processes"
          value={data ? String(agents.length) : "—"}
          detail="Detected · activity unverified"
        />
        <Metric
          icon={Activity}
          label="Process memory"
          value={data ? formatMemory(totalMemoryMb) : "—"}
          detail="Sum of RSS · shared pages may overlap"
        />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>
            Listening ports{" "}
            <Badge variant="secondary">{data?.listeners.length ?? "—"}</Badge>
          </CardTitle>
          <CardDescription>Know what’s behind your localhost.</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={onPorts}>
              View all ports
              <ArrowUpRight data-icon="inline-end" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <PortsTable
            listeners={listeners.slice(0, 6)}
            onInspect={onInspect}
            enabled={portsEnabled}
          />
        </CardContent>
        <CardFooter className="gap-2">
          <ShieldCheck className="size-3 text-primary" />
          <span className="text-xs text-muted-foreground">
            Observation only. No process controls are enabled.
          </span>
        </CardFooter>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI agent discovery</CardTitle>
            <CardDescription>
              Executable signatures, without session file access.
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onAgents}
                aria-label="View all agent processes"
              >
                <ArrowUpRight />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {agents.length ? (
              agents
                .slice(0, 3)
                .map((process) => (
                  <AgentCard
                    key={process.id}
                    process={process}
                    onInspect={onInspect}
                  />
                ))
            ) : (
              <ObservationEmpty
                title="No agent processes observed"
                description="A running process is not proof of an active session."
              />
            )}
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              No prompts, transcripts or session files accessed.
            </p>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Memory consumers</CardTitle>
            <CardDescription>
              Current RSS · shared pages may overlap.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {top.length ? (
              top.map((process) => (
                <div
                  key={process.id}
                  className="flex items-center justify-between gap-3"
                >
                  <Button
                    variant="ghost"
                    onClick={() => onInspect(process)}
                    aria-label={`Inspect ${process.name}, PID ${process.pid}`}
                  >
                    <Terminal data-icon="inline-start" />
                    <span className="max-w-48 truncate">{process.name}</span>
                  </Button>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatMemory(process.memoryMb)}
                  </span>
                </div>
              ))
            ) : (
              <ObservationEmpty
                title="Awaiting an observation"
                description="Resources appear after the first desktop snapshot."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
