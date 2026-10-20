import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { StorageResource } from "./types";
export function CleanupSheet({
  resource,
  busy,
  onClose,
  onConfirm,
}: {
  resource: StorageResource | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (id: string, confirmation: string) => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const name = resource?.path.split("/").at(-1) ?? "";
  return (
    <Sheet
      open={!!resource}
      onOpenChange={(open) => {
        if (!open && !busy) {
          onClose();
          setConfirmation("");
        }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Review move to Trash</SheetTitle>
          <SheetDescription>
            One directory, with its contents. Restore by dragging the folder out
            of Finder’s Trash if needed.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-6 text-sm">
          <p className="break-all rounded-md border bg-muted p-3 font-mono text-xs">
            {resource?.path}
          </p>
          <p>
            Active use is unknown. Stop any builds or agents using this
            directory first. Dependencies may need to be downloaded again; local
            modifications inside them will move too.
          </p>
          <p>
            This does not immediately free disk space. Portglass does not empty
            Trash. If the scan or directory has changed, the backend rejects
            this action.
          </p>
          <div className="space-y-2">
            <Label htmlFor="trash-confirmation">Type {name} to confirm</Label>
            <Input
              id="trash-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              disabled={busy}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || confirmation !== name}
            onClick={() => {
              if (resource)
                void onConfirm(resource.id, confirmation).then(() => {
                  onClose();
                  setConfirmation("");
                });
            }}
          >
            {busy ? "Moving…" : "Move to Trash"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
