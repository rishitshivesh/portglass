import { Fragment } from "react";
import { ObservationAlert } from "@/components/observation-alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatMemory, formatTime } from "@/lib/format";
import type { Listener, Process } from "@/types";
import { FocusApplication } from "./focus-application";

export interface ResourceSelection {
  resource: Listener | Process;
  capturedAt: number;
  processId: string | null;
}
export function ResourceInspector({
  selection,
  onClose,
}: {
  selection: ResourceSelection | null;
  onClose: () => void;
}) {
  const resource = selection?.resource;
  const fields = !resource
    ? {}
    : "port" in resource
      ? {
          Protocol: `TCP / ${resource.family}`,
          Address: resource.address,
          Process: resource.name || "Unknown",
          PID: resource.pid,
          "Owner UID": resource.uid || "Unknown",
          Source: "macOS lsof",
          Visibility: "Limited by OS permissions",
        }
      : {
          Executable: resource.name,
          PID: resource.pid,
          "Parent PID": resource.parent,
          "Owner UID": resource.uid,
          "Started (host local)": resource.started,
          "CPU (lifetime average)": `${resource.cpu}%`,
          "Memory RSS": formatMemory(resource.memoryMb),
          Agent: resource.agent
            ? `${resource.agent} · detected, activity unverified`
            : "Not detected",
          Source: "macOS ps",
        };
  return (
    <Sheet
      open={selection !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {resource
              ? "port" in resource
                ? `Port ${resource.port}`
                : resource.name
              : "Resource inspector"}
          </SheetTitle>
          <SheetDescription>
            Metadata observed at{" "}
            {selection ? formatTime(selection.capturedAt) : "unknown time"}.
            This view preserves the selected observation.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          <FocusApplication
            key={selection?.resource.id}
            processId={selection?.processId ?? null}
            listenerId={
              resource && "port" in resource ? resource.id : undefined
            }
          />
          <dl className="grid grid-cols-[1fr_1.4fr] gap-4 text-sm">
            {Object.entries(fields).map(([label, value]) => (
              <Fragment key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-all font-mono text-xs">{value}</dd>
              </Fragment>
            ))}
          </dl>
          <ObservationAlert title="Read-only inspection">
            Process controls are deferred until identity and impact checks are
            implemented.
          </ObservationAlert>
          <p className="text-xs text-muted-foreground">
            No arguments, full paths, environment values or session contents are
            retained in snapshots or exposed to this interface.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
