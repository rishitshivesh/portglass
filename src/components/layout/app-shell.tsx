import {
  ChevronRight,
  Layers,
  Lock,
  PanelLeft,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import type { ReactNode } from "react";
import { navigation, type Page } from "@/app/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { desktopAvailable } from "@/features/observations/transport";

export function AppShell({
  page,
  onNavigate,
  ports,
  agents,
  children,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  ports: number;
  agents: number;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-16 flex-col border-r bg-sidebar px-2 py-6 md:w-56 md:px-4">
        <div className="flex items-center justify-center gap-3 px-2 md:justify-start">
          <Layers className="size-7 text-primary" />
          <span className="hidden text-2xl font-semibold tracking-tight md:block">
            portglass<span className="text-primary">.</span>
          </span>
        </div>
        <div className="my-8 hidden items-center gap-3 rounded-lg border bg-card p-3 md:flex">
          <Terminal className="size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Local machine</p>
            <p className="text-xs text-muted-foreground">macOS workspace</p>
          </div>
        </div>
        <p className="mb-3 mt-8 hidden px-3 text-[10px] font-medium tracking-widest text-muted-foreground md:mt-0 md:block">
          WORKSPACE
        </p>
        <nav
          aria-label="Workspace"
          className="mt-6 flex flex-col gap-2 md:mt-0"
        >
          {navigation.map(({ name, icon: Icon }) => (
            <Button
              key={name}
              variant={page === name ? "secondary" : "ghost"}
              className="justify-start"
              aria-label={name}
              aria-current={page === name ? "page" : undefined}
              onClick={() => onNavigate(name)}
            >
              <Icon data-icon="inline-start" />
              <span className="hidden md:inline">{name}</span>
              {(name === "Ports" || name === "AI Agents") && (
                <Badge
                  variant="outline"
                  className="ml-auto hidden md:inline-flex"
                >
                  {name === "Ports" ? ports : agents}
                </Badge>
              )}
            </Button>
          ))}
        </nav>
        <div className="mt-auto hidden md:block">
          <Separator />
          <div className="flex gap-2 py-5">
            <ShieldCheck className="size-4 text-primary" />
            <div>
              <p className="text-xs">Your machine. Your data.</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Local only. Read-only by default.
              </p>
            </div>
          </div>
          <Separator />
          <p className="pt-4 text-[10px] text-muted-foreground">
            Portglass v{__APP_VERSION__} · MACOS
          </p>
        </div>
      </aside>
      <main className="ml-16 md:ml-56">
        <header className="flex h-16 items-center justify-between gap-4 border-b px-6 lg:px-8">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <PanelLeft className="size-4" />
            <span>Workspace</span>
            <ChevronRight className="size-3" />
            <span className="text-foreground">{page}</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">
              <Lock data-icon="inline-start" />
              {page === "Storage" ? "Reviewed controls" : "Read-only"}
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {desktopAvailable ? "Local connection" : "Browser preview"}
            </span>
          </div>
        </header>
        <div className="mx-auto flex max-w-7xl flex-col gap-6 p-5 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
