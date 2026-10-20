import { invoke } from "@tauri-apps/api/core";
import { AppWindow } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { desktopAvailable } from "@/features/observations/transport";

export function FocusApplication({
  processId,
  listenerId,
}: {
  processId: string | null;
  listenerId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const focus = async () => {
    if (!processId || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const receipt = await invoke<{ applicationName: string; scope: string }>(
        "focus_application",
        { processId, listenerId: listenerId ?? null },
      );
      setMessage(
        receipt.scope === "current-application"
          ? "This resource belongs to Portglass, the application you are viewing. No activation is needed."
          : receipt.scope === "already-active"
            ? `${receipt.applicationName} is already frontmost.`
            : `Activation requested for ${receipt.applicationName}. Exact tab or agent session selection is unavailable.`,
      );
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        disabled={!desktopAvailable || !processId || busy}
        onClick={() => void focus()}
      >
        <AppWindow data-icon="inline-start" />
        {busy ? "Finding application…" : "Focus application"}
      </Button>
      <p role="status" className="text-xs text-muted-foreground">
        {message ||
          (processId
            ? "Focuses the owning app or terminal when verified. Does not select a particular tab."
            : "Enable process collection and refresh to verify the owner.")}
      </p>
    </div>
  );
}
