import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const toolchains = join(homedir(), ".rustup", "toolchains");
const candidates = ["rustfmt"];
const env = { ...process.env };
if (existsSync(toolchains)) {
  const stable = readdirSync(toolchains).find((name) =>
    name.startsWith("stable-"),
  );
  if (stable) env.DYLD_LIBRARY_PATH = join(toolchains, stable, "lib");
}
if (existsSync(toolchains))
  for (const name of readdirSync(toolchains))
    candidates.push(join(toolchains, name, "bin", "rustfmt"));
const localTools = join(root, ".tooling", "rustfmt");
if (existsSync(localTools))
  for (const name of readdirSync(localTools))
    candidates.push(
      join(localTools, name, "rustfmt-preview", "bin", "rustfmt"),
    );
const formatter = candidates.find(
  (candidate) =>
    spawnSync(candidate, ["--version"], { stdio: "ignore", env }).status === 0,
);
if (!formatter) {
  console.error(
    "Rustfmt is missing. Install it with: rustup component add rustfmt",
  );
  process.exit(1);
}
const files = [
  "src-tauri/src/lib.rs",
  "src-tauri/src/main.rs",
  "src-tauri/build.rs",
  "src-tauri/examples/smoke.rs",
];
const result = spawnSync(
  formatter,
  ["--edition", "2021", ...process.argv.slice(2), ...files],
  { cwd: root, stdio: "inherit", env },
);
process.exitCode = result.status ?? 1;
