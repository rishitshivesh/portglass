import { Radio, Search } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

export function ObservationToolbar({
  query,
  onQuery,
  inputRef,
  autoRefresh,
  onAutoRefresh,
}: {
  query: string;
  onQuery: (query: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  autoRefresh: boolean;
  onAutoRefresh: (enabled: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <InputGroup className="min-w-48 flex-1">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          aria-label="Search observations"
          placeholder="Search a port, process, PID, or agent…"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>⌘ K</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={autoRefresh}
        onClick={() => onAutoRefresh(!autoRefresh)}
      >
        <Radio data-icon="inline-start" />
        {autoRefresh ? "Auto-refresh on" : "Auto-refresh paused"}
      </Button>
    </div>
  );
}
