import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { CollectorSettings } from "@/features/observations/snapshot-controller";
import type { Capability } from "@/types";

export function CollectorsView({
  settings,
  capabilities,
  onEnabled,
}: {
  settings: CollectorSettings;
  capabilities: Capability[];
  onEnabled: (key: keyof CollectorSettings, enabled: boolean) => void;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Host metadata</CardTitle>
          <CardDescription>
            Fixed, bounded commands. No administrator privileges or background
            daemon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="process-collector">
                  Processes & agent discovery
                </FieldLabel>
                <FieldDescription>
                  PID, parent, numeric UID, start time, basename, CPU average
                  and RSS.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="process-collector"
                checked={settings.processesEnabled}
                onCheckedChange={(enabled) =>
                  onEnabled("processesEnabled", enabled)
                }
                aria-label="Enable process collection"
              />
            </Field>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="port-collector">TCP listeners</FieldLabel>
                <FieldDescription>
                  Listening addresses, address family, ports and visible owners.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="port-collector"
                checked={settings.portsEnabled}
                onCheckedChange={(enabled) =>
                  onEnabled("portsEnabled", enabled)
                }
                aria-label="Enable TCP listener collection"
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Collector capabilities</CardTitle>
          <CardDescription>
            Coverage is explicit; restricted visibility is never presented as
            complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {capabilities.map((capability) => (
            <div
              key={capability.name}
              className="flex items-start justify-between gap-4"
            >
              <div>
                <p className="text-sm font-medium">{capability.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {capability.detail}
                </p>
              </div>
              <Badge
                variant={
                  capability.state === "error" ? "destructive" : "outline"
                }
              >
                {capability.state}
              </Badge>
            </div>
          ))}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                Developer storage · Docker usage
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                On demand from Storage. Folder selection or an explicit local
                Docker query is required; neither polls automatically.
              </p>
            </div>
            <Badge variant="outline">On demand</Badge>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                Homebrew · Redis · Provider metadata
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Deferred. No connections, hooks or file reads.
              </p>
            </div>
            <Badge variant="outline">Not enabled</Badge>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
