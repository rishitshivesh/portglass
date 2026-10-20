import type { Process } from "../../types.ts";

export type AgentState =
  | "unknown"
  | "working"
  | "waiting-approval"
  | "waiting-input"
  | "idle"
  | "turn-complete"
  | "error"
  | "ended";
export interface AgentSignal {
  processIdentity: string;
  sessionId: string;
  state: Exclude<AgentState, "unknown">;
  source: "claude-hook" | "codex-app-server";
  observedAt: number;
  validUntil: number;
}
export interface AgentStatus {
  state: AgentState;
  label: string;
  attention: "required" | "none" | "unknown";
  source: "process-only" | AgentSignal["source"];
  reason: string;
}
const labels: Record<AgentState, string> = {
  unknown: "State unknown",
  working: "Working",
  "waiting-approval": "Awaiting approval",
  "waiting-input": "Awaiting input",
  idle: "Idle",
  "turn-complete": "Turn complete",
  error: "Error",
  ended: "Ended",
};

/** Only normalized, authorized provider metadata may supply a positive state. */
export function deriveAgentStatus(
  process: Process,
  signal?: AgentSignal,
  now = Date.now(),
): AgentStatus {
  const unknown: AgentStatus = {
    state: "unknown",
    label: labels.unknown,
    attention: "unknown",
    source: "process-only",
    reason:
      "Only process metadata is available. Activity and attention require an opt-in provider integration.",
  };
  if (!signal) return unknown;
  if (
    signal.processIdentity !== process.id ||
    !signal.sessionId ||
    !Number.isFinite(signal.observedAt) ||
    !Number.isFinite(signal.validUntil) ||
    signal.observedAt > now ||
    signal.validUntil <= now ||
    signal.validUntil <= signal.observedAt
  ) {
    return {
      ...unknown,
      reason:
        "Provider evidence is stale, invalid or belongs to a different process identity.",
    };
  }
  return {
    state: signal.state,
    label: labels[signal.state],
    attention: ["waiting-approval", "waiting-input", "error"].includes(
      signal.state,
    )
      ? "required"
      : "none",
    source: signal.source,
    reason:
      "Based on a current, session-correlated provider event; no prompt or transcript content is needed.",
  };
}
