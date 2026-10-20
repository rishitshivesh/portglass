import { FolderSearch, HardDrive, RefreshCw } from "lucide-react";
import { useState } from "react";
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
import { desktopAvailable } from "@/features/observations/transport";
import { CleanupSheet } from "./cleanup-sheet";
import { DockerPanel } from "./docker-panel";
import { ResourceList } from "./resource-list";
import type { StorageResource } from "./types";
import { useStorage } from "./use-storage";
export function StorageView() {
  const storage = useStorage();
  const [selection, setSelection] = useState<StorageResource | null>(null);
  const report = storage.report;
  return (
    <div className="space-y-6">
      {storage.error && (
        <ObservationAlert title="Storage operation failed" destructive>
          {storage.error}
        </ObservationAlert>
      )}
      {storage.notice && (
        <ObservationAlert title="Storage updated">
          {storage.notice}
        </ObservationAlert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Find your developer footprint</CardTitle>
          <CardDescription>
            One entry per dependency, cache or outer build folder. A .next or
            dist entry includes everything inside it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!desktopAvailable || !!storage.busy}
              onClick={() => {
                setSelection(null);
                void storage.system();
              }}
            >
              <HardDrive data-icon="inline-start" />
              {storage.busy === "scan"
                ? "Scanning…"
                : "Scan developer locations"}
            </Button>
            <Button
              variant="outline"
              disabled={!desktopAvailable || !!storage.busy}
              onClick={() => {
                setSelection(null);
                void storage.scan();
              }}
            >
              <FolderSearch data-icon="inline-start" />
              Choose scan root
            </Button>
            {report && (
              <Button
                variant="outline"
                disabled={!!storage.busy}
                onClick={() => {
                  setSelection(null);
                  void storage.refresh();
                }}
              >
                <RefreshCw data-icon="inline-start" />
                Rescan now
              </Button>
            )}
            {storage.busy === "scan" && (
              <Button variant="outline" onClick={() => void storage.cancel()}>
                Cancel
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Common locations include Projects, Developer, package caches, Xcode
            builds, simulators and Android SDK storage in your account. Choose a
            root for other folders. Each scan is bounded; no file contents are
            read.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3 text-xs">
            <span>
              Local cache · last 4 scan results · reuse for 15 minutes · cached
              results never authorize cleanup
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={!desktopAvailable || !!storage.busy}
              onClick={() => void storage.clear()}
            >
              Clear scan cache
            </Button>
          </div>
        </CardContent>
      </Card>
      {report ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="break-all text-lg font-semibold">{report.root}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Observed {new Date(report.capturedAt * 1000).toLocaleString()} ·{" "}
                {report.cached ? "Restored from local cache" : "Fresh scan"}
              </p>
            </div>
            <Badge variant="outline">
              {report.cached ? "Cached · rescan for cleanup" : report.status}
            </Badge>
          </div>
          {report.status !== "complete" && (
            <ObservationAlert title="Partial scan">
              This scan{" "}
              {report.status === "cancelled"
                ? "was cancelled"
                : "reached its budget"}
              . Sizes below may be incomplete. Choose a narrower root for a
              complete result.
            </ObservationAlert>
          )}
          {report.cacheNote && (
            <ObservationAlert title="Cache unavailable">
              {report.cacheNote}
            </ObservationAlert>
          )}
          <ResourceList
            key={`${report.root}:${report.capturedAt}:${report.cached}`}
            resources={report.resources}
            busy={!!storage.busy}
            onReview={setSelection}
          />
          <details className="rounded-lg border p-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              Scan coverage and size details
            </summary>
            <div className="mt-3 space-y-3">
              <p>
                {report.entries.toLocaleString()} entries · {report.skipped}{" "}
                excluded or unfollowed links · {report.errors} inaccessible ·{" "}
                {report.durationMs} ms
              </p>
              <p>
                30-second cooperative budget, 250,000 entries, 48 levels. Slow
                filesystem calls can delay cancellation. Symlink targets, other
                filesystems and sensitive directories are excluded.
              </p>
              <p>
                Allocated bytes count hard links once within this scan. APFS
                clones/compression and shared stores prevent a promise of exact
                reclaimable space. Build folder totals include nested contents;
                nested outputs are not separate rows.
              </p>
              <p>
                Active use and project ownership are unknown. Cleanup is limited
                to fresh, complete nested Node/Python environments. Build
                outputs, caches, selected roots and cached results are
                observe-only.
              </p>
              <p className="font-medium text-foreground">Requested locations</p>
              {report.roots.map((root) => (
                <p key={root} className="break-all font-mono">
                  {root}
                </p>
              ))}
            </div>
          </details>
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Scan common developer locations or choose a project. Saved results
          reappear here when you reopen Portglass.
        </div>
      )}
      <DockerPanel
        endpoints={storage.endpoints}
        usage={storage.docker}
        discovered={storage.discovered}
        busy={storage.busy === "docker"}
        available={desktopAvailable && !storage.busy}
        onDiscover={() => void storage.discover()}
        onRead={(id) => void storage.connectDocker(id)}
      />
      <CleanupSheet
        key={selection?.id ?? "closed"}
        resource={selection}
        busy={storage.busy === "trash"}
        onClose={() => setSelection(null)}
        onConfirm={storage.trash}
      />
    </div>
  );
}
