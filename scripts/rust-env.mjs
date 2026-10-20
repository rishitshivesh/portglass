import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
export function rustEnvironment(root) {
  const env = { ...process.env };
  const toolchains = join(homedir(), ".rustup", "toolchains");
  if (existsSync(toolchains)) {
    const stable = readdirSync(toolchains).find(
      (name) =>
        name.startsWith("stable-") &&
        existsSync(join(toolchains, name, "bin", "cargo")),
    );
    if (stable)
      env.PATH = join(toolchains, stable, "bin") + delimiter + (env.PATH ?? "");
  }
  if (!existsSync(join(homedir(), ".cargo")))
    env.CARGO_HOME = join(root, ".tooling", "cargo");
  return env;
}
