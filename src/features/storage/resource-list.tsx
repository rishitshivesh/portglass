import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatBytes,
  type ResourceGroup,
  resourceGroup,
  resourceGroups,
} from "./resource-groups";
import type { StorageResource } from "./types";
export function ResourceList({
  resources,
  busy,
  onReview,
}: {
  resources: StorageResource[];
  busy: boolean;
  onReview: (resource: StorageResource) => void;
}) {
  const [group, setGroup] = useState<ResourceGroup>("All");
  const [page, setPage] = useState(0);
  const totals = useMemo(
    () =>
      new Map(
        resourceGroups.map((group) => [
          group,
          resources
            .filter((r) => group === "All" || resourceGroup(r) === group)
            .reduce((sum, r) => sum + r.allocatedBytes, 0),
        ]),
      ),
    [resources],
  );
  const filtered = useMemo(
    () =>
      resources.filter(
        (resource) => group === "All" || resourceGroup(resource) === group,
      ),
    [resources, group],
  );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {resourceGroups.map((name) => (
          <Button
            key={name}
            variant={group === name ? "secondary" : "outline"}
            className="h-auto flex-col items-start p-4"
            onClick={() => {
              setGroup(name);
              setPage(0);
            }}
          >
            <span className="text-xs">{name}</span>
            <span className="text-lg">
              {formatBytes(totals.get(name) ?? 0)}
            </span>
          </Button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No recognized resources in this category. Check scan coverage below.
        </p>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.slice(page * 24, (page + 1) * 24).map((resource) => (
            <Card key={resource.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate">
                      {resource.path.split("/").at(-1)}
                    </CardTitle>
                    <CardDescription>
                      {resource.category} · whole folder
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {resource.complete ? "Measured" : "Partial"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {resource.path}
                </p>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold">
                      {formatBytes(resource.allocatedBytes)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      allocated · {formatBytes(resource.logicalBytes)} logical
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!resource.trashAllowed || busy}
                    onClick={() => onReview(resource)}
                  >
                    <Trash2 data-icon="inline-start" />
                    {resource.trashAllowed ? "Review cleanup" : "Observe only"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {filtered.length > 24 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {page * 24 + 1}–{Math.min((page + 1) * 24, filtered.length)} of{" "}
            {filtered.length}
          </span>
          <Button
            variant="outline"
            disabled={(page + 1) * 24 >= filtered.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
