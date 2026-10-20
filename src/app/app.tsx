import { RefreshCw, ShieldCheck } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { navigation, type Page } from "@/app/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ObservationAlert } from "@/components/observation-alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { AgentsView } from "@/features/agents/agents-view";
import { CollectorsView } from "@/features/collectors/collectors-view";
import { DevToolsView } from "@/features/dev-tools/dev-tools-view";
import { ObservationToolbar } from "@/features/observations/components/observation-toolbar";
import { PortsTable } from "@/features/observations/components/ports-table";
import { ProcessesTable } from "@/features/observations/components/processes-table";
import {
  ResourceInspector,
  type ResourceSelection,
} from "@/features/observations/components/resource-inspector";
import {
  deriveSnapshot,
  filterObservations,
} from "@/features/observations/selectors";
import type { CollectorSettings } from "@/features/observations/snapshot-controller";
import { desktopAvailable } from "@/features/observations/transport";
import { useObservations } from "@/features/observations/use-observations";
import { OverviewView } from "@/features/overview/overview-view";
import { StorageView } from "@/features/storage/storage-view";
import { formatTime } from "@/lib/format";
import type { Listener, Process } from "@/types";

export function App() {
  const {
    data,
    error,
    loading,
    settings,
    autoRefresh,
    refresh,
    setEnabled,
    setAutoRefresh,
  } = useObservations();
  const [page, setPage] = useState<Page>("Overview");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selection, setSelection] = useState<ResourceSelection | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const derived = useMemo(() => deriveSnapshot(data), [data]);
  const filtered = useMemo(
    () => filterObservations(derived, deferredQuery),
    [derived, deferredQuery],
  );
  const currentPage =
    navigation.find((item) => item.name === page) ?? navigation[0];
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        search.current?.focus();
      }
      if (event.key === "Escape" && !event.defaultPrevented && !selection)
        setQuery("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);
  const navigate = (next: Page) => {
    setPage(next);
    setQuery("");
    setSelection(null);
  };
  const inspect = (resource: Listener | Process) => {
    if (data) {
      const process =
        "port" in resource
          ? data.processes.find((process) => process.pid === resource.pid)
          : resource;
      setSelection({
        resource,
        capturedAt: data.capturedAt,
        processId: process?.id ?? null,
      });
    }
  };
  const changeCollector = (key: keyof CollectorSettings, enabled: boolean) => {
    setSelection(null);
    setEnabled(key, enabled);
  };
  return (
    <AppShell
      page={page}
      onNavigate={navigate}
      ports={data?.listeners.length ?? 0}
      agents={derived.allAgents.length}
    >
      <div>
        <p className="mb-3 text-[10px] font-medium tracking-[0.2em] text-muted-foreground">
          YOUR DEVELOPMENT ENVIRONMENT
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
              {currentPage.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {currentPage.description}
            </p>
          </div>
          {page !== "Storage" && (
            <Button
              variant="outline"
              disabled={loading || !desktopAvailable}
              onClick={() => void refresh()}
            >
              {loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              {loading ? "Observing…" : "Refresh"}
            </Button>
          )}
        </div>
      </div>
      {!desktopAvailable && (
        <ObservationAlert title="Desktop connection required">
          This browser preview has no machine access. Run{" "}
          <code>npm run desktop</code> for live observations.
        </ObservationAlert>
      )}
      {error && (
        <ObservationAlert title="Observation failed" destructive>
          {error}
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
        </ObservationAlert>
      )}
      {page !== "Storage" && (
        <ObservationToolbar
          query={query}
          onQuery={setQuery}
          inputRef={search}
          autoRefresh={autoRefresh}
          onAutoRefresh={setAutoRefresh}
        />
      )}
      {data?.capabilities
        .filter((capability) => capability.state === "error")
        .map((capability) => (
          <ObservationAlert
            key={capability.name}
            title={`${capability.name} collector failed`}
            destructive
          >
            {capability.detail}
          </ObservationAlert>
        ))}
      {loading && !data && (
        <div
          role="status"
          aria-label="Collecting observations"
          className="grid grid-cols-2 gap-4"
        >
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
      {page === "Overview" && (
        <OverviewView
          data={data}
          listeners={filtered.listeners}
          agents={derived.allAgents}
          top={derived.top}
          totalMemoryMb={derived.totalMemoryMb}
          portsEnabled={settings.portsEnabled}
          onInspect={inspect}
          onPorts={() => navigate("Ports")}
          onAgents={() => navigate("AI Agents")}
        />
      )}
      {page === "Ports" && (
        <Card>
          <CardHeader>
            <CardTitle>TCP listening endpoints</CardTitle>
            <CardDescription>
              IPv4 and IPv6 are distinct. Source: macOS lsof.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PortsTable
              listeners={filtered.listeners}
              onInspect={inspect}
              enabled={settings.portsEnabled}
            />
          </CardContent>
        </Card>
      )}
      {page === "Processes" && (
        <ProcessesTable
          key={deferredQuery}
          processes={filtered.processes}
          onInspect={inspect}
        />
      )}
      {page === "AI Agents" && (
        <AgentsView agents={filtered.agents} onInspect={inspect} />
      )}
      {page === "Dev Tools" && (
        <DevToolsView
          processes={data?.processes ?? []}
          query={deferredQuery}
          enabled={settings.processesEnabled}
          onInspect={inspect}
        />
      )}
      <div hidden={page !== "Storage"}>
        <StorageView />
      </div>
      {page === "Collectors" && (
        <CollectorsView
          settings={settings}
          capabilities={data?.capabilities ?? []}
          onEnabled={changeCollector}
        />
      )}
      <footer className="flex flex-wrap justify-between gap-3 border-t py-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-3" />
          Observe by default · cleanup requires confirmation
        </span>
        <span>
          {data
            ? `Observed ${formatTime(data.capturedAt)} · ${data.durationMs} ms collection`
            : "No machine snapshot collected"}{" "}
          ·{" "}
          {autoRefresh
            ? "Updates every 10s while visible"
            : "Auto-refresh paused"}
        </span>
      </footer>
      <ResourceInspector
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </AppShell>
  );
}
