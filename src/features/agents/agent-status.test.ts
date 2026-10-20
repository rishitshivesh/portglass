import assert from "node:assert/strict";
import test from "node:test";
import type { Process } from "../../types.ts";
import { type AgentSignal, deriveAgentStatus } from "./agent-status.ts";

const process: Process = {
  id: "42:started:501:codex",
  pid: 42,
  parent: 1,
  uid: "501",
  started: "started",
  name: "codex",
  cpu: 99,
  memoryMb: 100,
  agent: "Codex",
};
const event: AgentSignal = {
  processIdentity: process.id,
  sessionId: "session",
  state: "waiting-approval",
  source: "codex-app-server",
  observedAt: 100,
  validUntil: 200,
};
test("process activity never implies working, idle or no attention", () => {
  assert.equal(deriveAgentStatus(process).state, "unknown");
  assert.equal(deriveAgentStatus({ ...process, cpu: 0 }).attention, "unknown");
});
test("current explicit provider requests indicate attention", () => {
  assert.equal(deriveAgentStatus(process, event, 150).attention, "required");
  assert.equal(
    deriveAgentStatus(process, { ...event, state: "waiting-input" }, 150).label,
    "Awaiting input",
  );
});
test("stale, future or PID-reused evidence is unknown", () => {
  assert.equal(deriveAgentStatus(process, event, 250).attention, "unknown");
  assert.equal(deriveAgentStatus(process, event, 50).state, "unknown");
  assert.equal(
    deriveAgentStatus(
      process,
      { ...event, processIdentity: "42:restarted:501:codex" },
      150,
    ).state,
    "unknown",
  );
});
test("turn completion is distinct from a completed task", () => {
  const status = deriveAgentStatus(
    process,
    { ...event, state: "turn-complete" },
    150,
  );
  assert.equal(status.label, "Turn complete");
  assert.equal(status.attention, "none");
});
