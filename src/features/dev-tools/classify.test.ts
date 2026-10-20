import assert from "node:assert/strict";
import test from "node:test";
import type { Process } from "../../types.ts";
import { groupDevTools } from "./classify.ts";

const p = (pid: number, name: string, parent = 1, uid = "501"): Process => ({
  id: `${pid}:start:${uid}:${name}`,
  pid,
  parent,
  uid,
  name,
  started: "start",
  cpu: 1,
  memoryMb: 10,
  agent: null,
});
test("each process contributes once and runtime children are attributed to their IDE", () => {
  const processes = [
    p(10, "webstorm"),
    p(11, "node", 10),
    p(12, "helper", 11),
    p(13, "redis-server"),
    p(14, "java"),
  ];
  const groups = groupDevTools(processes);
  assert.equal(groups.find((g) => g.name === "JetBrains IDEs")?.memoryMb, 30);
  assert.equal(groups.flatMap((g) => g.processes).length, 5);
  assert.equal(
    groups.find((g) => g.name === "Java runtime · unassigned")?.category,
    "Language runtimes",
  );
});
test("unrelated applications and other-user ancestry do not become IDE processes", () => {
  const groups = groupDevTools([
    p(1, "webstorm", 0, "502"),
    p(2, "generic", 1),
    p(3, "Safari", 0),
  ]);
  assert.equal(groups.flatMap((g) => g.processes).length, 1);
});
test("cycles are bounded and ambiguous VM processes stay unattributed", () => {
  const groups = groupDevTools([
    p(1, "helper", 2),
    p(2, "helper", 1),
    p(3, "qemu-system-aarch64", 0),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "Virtual machines");
});
test("explicit Redis signature stays separate even when started by an IDE", () => {
  const groups = groupDevTools([p(1, "webstorm", 0), p(2, "redis-server", 1)]);
  assert.equal(groups.find((group) => group.name === "Redis")?.memoryMb, 10);
  assert.equal(
    groups.find((group) => group.name === "JetBrains IDEs")?.memoryMb,
    10,
  );
});
