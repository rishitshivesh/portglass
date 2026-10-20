import { ObservationAlert } from "@/components/observation-alert";
import { ObservationEmpty } from "@/components/observation-empty";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AgentCard } from "@/features/agents/agent-card";
import type { Process } from "@/types";

export function AgentsView({
  agents,
  onInspect,
}: {
  agents: Process[];
  onInspect: (process: Process) => void;
}) {
  return (
    <>
      <ObservationAlert title="Detected does not mean active">
        Activity and attention are unknown until an opt-in provider integration
        is connected. A running process, high CPU or low CPU cannot establish
        whether an agent needs you.
      </ObservationAlert>
      <div className="grid gap-4 lg:grid-cols-2">
        {agents.map((process) => (
          <Card key={process.id}>
            <CardHeader>
              <CardTitle>{process.agent}</CardTitle>
              <CardDescription>
                Exact executable signature · activity unverified.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AgentCard process={process} onInspect={onInspect} />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-muted-foreground">Executable</dt>
                <dd>{process.name}</dd>
                <dt className="text-muted-foreground">Needs attention</dt>
                <dd>Not observed</dd>
                <dt className="text-muted-foreground">Coverage</dt>
                <dd>Process metadata only</dd>
                <dt className="text-muted-foreground">Project / model</dt>
                <dd>Not observed</dd>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
      {!agents.length && (
        <ObservationEmpty
          title="No matching agent processes"
          description="Exact signatures support Codex, Claude Code, Gemini CLI and OpenCode. Node-hosted agents may remain undetected."
        />
      )}
    </>
  );
}
