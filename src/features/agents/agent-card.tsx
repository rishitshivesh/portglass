import { ChevronRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMemory } from "@/lib/format";
import type { Process } from "@/types";
import { deriveAgentStatus } from "./agent-status";

export function AgentCard({
  process,
  onInspect,
}: {
  process: Process;
  onInspect: (process: Process) => void;
}) {
  const status = deriveAgentStatus(process);
  return (
    <div className="flex items-center gap-3 py-3">
      <Sparkles className="size-5 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{process.agent}</p>
        <p className="text-xs text-muted-foreground">
          PID {process.pid} · {formatMemory(process.memoryMb)}
        </p>
        <p className="text-xs text-muted-foreground">
          {status.label} · Attention not observed
        </p>
      </div>
      <Badge variant="secondary">Detected</Badge>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Inspect agent process ${process.pid}`}
        onClick={() => onInspect(process)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
