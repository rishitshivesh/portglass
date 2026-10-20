import { ChevronRight, Terminal } from "lucide-react";
import { ObservationEmpty } from "@/components/observation-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Listener } from "@/types";

export function PortsTable({
  listeners,
  onInspect,
  enabled,
}: {
  listeners: Listener[];
  onInspect: (listener: Listener) => void;
  enabled: boolean;
}) {
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Port / address</TableHead>
            <TableHead>Process</TableHead>
            <TableHead>PID</TableHead>
            <TableHead>Protocol</TableHead>
            <TableHead>Observation</TableHead>
            <TableHead>
              <span className="sr-only">Inspect</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listeners.map((listener) => (
            <TableRow key={listener.id}>
              <TableCell>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => onInspect(listener)}
                >
                  :{listener.port}
                </Button>
                <p className="font-mono text-xs text-muted-foreground">
                  {listener.address}
                </p>
              </TableCell>
              <TableCell>
                <Terminal className="mr-2 inline size-4 text-muted-foreground" />
                {listener.name || "Unknown owner"}
              </TableCell>
              <TableCell className="font-mono text-muted-foreground">
                {listener.pid || "Unknown"}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  TCP · {listener.family || "Unknown"}
                </Badge>
              </TableCell>
              <TableCell>Listening</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Inspect port ${listener.port}`}
                  onClick={() => onInspect(listener)}
                >
                  <ChevronRight />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!listeners.length && (
        <ObservationEmpty
          title={
            enabled ? "No visible listeners" : "Listener collection disabled"
          }
          description={
            enabled
              ? "No matches in this observation. OS permissions may limit visibility."
              : "Enable the TCP listener collector to observe endpoints."
          }
        />
      )}
    </>
  );
}
