import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";

const env = { ...process.env };
const root = resolve(import.meta.dirname, "..");
const toolchains = join(homedir(), ".rustup", "toolchains");
if (existsSync(toolchains)) {
  const stable = readdirSync(toolchains).find(
    (n) =>
      n.startsWith("stable-") &&
      existsSync(join(toolchains, n, "bin", "cargo")),
  );
  if (stable)
    env.PATH = join(toolchains, stable, "bin") + delimiter + (env.PATH ?? "");
}
if (!existsSync(join(homedir(), ".cargo")))
  env.CARGO_HOME = join(root, ".tooling", "cargo");
const args = process.argv.slice(2);
const binary = join(root, "src-tauri", "target", "debug", "portglass");
if (args[0] === "dev" && existsSync(binary)) {
  const probe = spawn(binary, ["--activate-existing"], {
    cwd: root,
    env,
    stdio: "ignore",
  });
  const result = await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.once("exit", resolve);
  });
  if (result === 0) {
    console.log("Opened the running Portglass instance.");
    process.exit(0);
  }
  if (result !== 42)
    throw new Error(`Portglass instance probe failed (${result})`);
}
const core = args[0] === "test:core";
const child = spawn(
  core ? "cargo" : process.execPath,
  core
    ? ["test", "--manifest-path", "src-tauri/Cargo.toml", ...args.slice(1)]
    : [join(root, "node_modules", "@tauri-apps", "cli", "tauri.js"), ...args],
  { cwd: root, env, stdio: "inherit" },
);
child.on("error", (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
