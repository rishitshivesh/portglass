import assert from "node:assert/strict";
import test from "node:test";
import type { Snapshot } from "../../types.ts";
import { deriveSnapshot, filterObservations } from "./selectors.ts";
import {
  type CollectorSettings,
  SnapshotController,
} from "./snapshot-controller.ts";

function snapshot(capturedAt: number): Snapshot {
  return {
    capturedAt,
    processes: [],
    listeners: [],
    capabilities: [],
    durationMs: 0,
    platform: "macos",
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("revoking a collector discards the old response and immediately requests fresh settings", async () => {
  const requests: {
    settings: CollectorSettings;
    result: ReturnType<typeof deferred<Snapshot>>;
  }[] = [];
  const controller = new SnapshotController((settings) => {
    const result = deferred<Snapshot>();
    requests.push({ settings, result });
    return result.promise;
  });
  const first = controller.refresh();
  controller.setEnabled("portsEnabled", false);
  requests[0].result.resolve(snapshot(1));
  await first;
  assert.equal(controller.getSnapshot().data, null);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].settings.portsEnabled, false);
  requests[1].result.resolve(snapshot(2));
  await settle();
  assert.equal(controller.getSnapshot().data?.capturedAt, 2);
});
test("an error from revoked settings cannot overwrite the current state", async () => {
  const first = deferred<Snapshot>();
  let count = 0;
  const controller = new SnapshotController(() =>
    ++count === 1 ? first.promise : Promise.resolve(snapshot(2)),
  );
  const pending = controller.refresh();
  controller.setEnabled("processesEnabled", false);
  first.reject(new Error("stale error"));
  await pending;
  await settle();
  assert.equal(controller.getSnapshot().error, "");
  assert.equal(controller.getSnapshot().data?.capturedAt, 2);
});
test("refresh bursts are serialized and coalesced", async () => {
  const first = deferred<Snapshot>();
  let calls = 0;
  const controller = new SnapshotController(() =>
    ++calls === 1 ? first.promise : Promise.resolve(snapshot(2)),
  );
  const pending = controller.refresh();
  void controller.refresh();
  void controller.refresh();
  assert.equal(calls, 1);
  first.resolve(snapshot(1));
  await pending;
  await settle();
  assert.equal(calls, 2);
  assert.equal(controller.getSnapshot().loading, false);
});
test("disposal suppresses late results and queued collections", async () => {
  const first = deferred<Snapshot>();
  let calls = 0;
  const controller = new SnapshotController(() => {
    calls++;
    return first.promise;
  });
  const pending = controller.refresh();
  void controller.refresh();
  controller.dispose();
  first.resolve(snapshot(1));
  await pending;
  assert.equal(controller.getSnapshot().data, null);
  assert.equal(calls, 1);
});
test("collection failure preserves the last observation and supports recovery", async () => {
  let calls = 0;
  const controller = new SnapshotController(async () => {
    calls++;
    if (calls === 2) throw new Error("unavailable");
    return snapshot(calls);
  });
  await controller.refresh();
  await controller.refresh();
  assert.equal(controller.getSnapshot().data?.capturedAt, 1);
  assert.equal(controller.getSnapshot().error, "unavailable");
  await controller.refresh();
  assert.equal(controller.getSnapshot().data?.capturedAt, 3);
  assert.equal(controller.getSnapshot().error, "");
});
test("deriving and filtering do not mutate snapshots or infer agent activity", () => {
  const data = snapshot(1);
  data.processes = [
    {
      id: "1",
      pid: 1,
      parent: 0,
      uid: "501",
      started: "now",
      name: "codex",
      memoryMb: 8,
      cpu: 0,
      agent: "Codex",
    },
    {
      id: "2",
      pid: 2,
      parent: 1,
      uid: "501",
      started: "now",
      name: "node",
      memoryMb: 16,
      cpu: 0,
      agent: null,
    },
  ];
  const result = deriveSnapshot(data);
  assert.equal(result.processes[0].pid, 2);
  assert.equal(data.processes[0].pid, 1);
  assert.equal(result.allAgents.length, 1);
  const filtered = filterObservations(result, " CODEX ");
  assert.equal(filtered.processes.length, 1);
  assert.equal(filtered.agents.length, 1);
});
