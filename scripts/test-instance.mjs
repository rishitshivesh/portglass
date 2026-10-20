// Integration check against an already running native build. No UI automation,
// process termination, arguments or paths are passed to the activation socket.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(
  import.meta.dirname,
  "../src-tauri/target/debug/portglass",
);
function launch(path, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(path, args, { stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Secondary instance did not exit"));
    }, 5000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}
assert.equal(
  await launch(binary, ["--activate-existing"]),
  0,
  "Open Portglass before this integration check",
);
const directory = await mkdtemp(join(tmpdir(), "portglass-copy-test-"));
try {
  const copy = join(directory, "portglass-copy");
  await copyFile(binary, copy);
  const codes = await Promise.all(
    Array.from({ length: 8 }, (_, i) => launch(i % 2 ? copy : binary)),
  );
  assert.deepEqual(codes, Array(8).fill(0));
  console.log(
    "Eight concurrent launches, including a copied executable, reused the running instance and exited.",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
