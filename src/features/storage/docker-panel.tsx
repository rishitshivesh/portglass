import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DockerEndpoint, DockerUsage } from "./types";
export function DockerPanel({
  endpoints,
  usage,
  discovered,
  busy,
  available,
  onDiscover,
  onRead,
}: {
  endpoints: DockerEndpoint[];
  usage: DockerUsage | null;
  discovered: boolean;
  busy: boolean;
  available: boolean;
  onDiscover: () => void;
  onRead: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Container engine storage</CardTitle>
        <CardDescription>
          Docker Desktop, Colima profiles, OrbStack, Rancher Desktop and Lima.
          Choose a detected local engine.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          disabled={!available || busy}
          onClick={onDiscover}
        >
          {busy ? "Reading…" : "Find local engines"}
        </Button>
        <div className="flex flex-wrap gap-2">
          {endpoints.map((endpoint) => (
            <Button
              key={endpoint.id}
              variant="secondary"
              disabled={busy}
              title={endpoint.socket}
              onClick={() => onRead(endpoint.id)}
            >
              Read {endpoint.name}
            </Button>
          ))}
        </div>
        {discovered && endpoints.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No supported local Docker-compatible sockets found. Start your
            runtime, then find engines again. Custom and remote contexts are not
            queried.
          </p>
        )}
        {usage && (
          <>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {usage.endpoint}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {usage.rows.map((row) => (
                <div key={row.category} className="rounded-lg border p-4">
                  <p className="text-sm font-medium">{row.category}</p>
                  <p className="mt-2 text-lg font-semibold">{row.size}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.total} total · {row.active} active
                  </p>
                  <p className="mt-2 text-xs">
                    Reclaimable estimate: {row.reclaimable}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Docker's shared-layer estimates stay separate from folder totals. No
          automatic connection, remote contexts, prune or volume deletion.
          Unused volumes can contain databases. This does not measure host VM
          disk reclamation.
        </p>
      </CardContent>
    </Card>
  );
}
