import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Homebrew intentionally refuses cask style checks outside a tap. Create an
// isolated local fixture tap, never install its app, and always remove the tap.
const cask = resolve(process.argv[2] ?? "");
if (!existsSync(cask)) throw new Error("Pass the generated portglass.rb path");
const env = {
  ...process.env,
  HOMEBREW_NO_AUTO_UPDATE: "1",
  HOMEBREW_DEVELOPER: "1",
};
const run = (binary, args, options = {}) =>
  execFileSync(binary, args, { env, stdio: "inherit", ...options });
const repository = run("brew", ["--repository"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
}).trim();
const name = `portglass-ci/release-check-${process.pid}`;
const tap = join(
  repository,
  "Library/Taps/portglass-ci",
  `homebrew-release-check-${process.pid}`,
);
if (existsSync(tap))
  throw new Error("Validation tap already exists; leaving it untouched");
const source = mkdtempSync(join(tmpdir(), "portglass-cask-check-"));
let attempted = false;
try {
  mkdirSync(join(source, "Casks"));
  copyFileSync(cask, join(source, "Casks/portglass.rb"));
  run("git", ["init", "--quiet", source]);
  run("git", ["-C", source, "add", "Casks/portglass.rb"]);
  run("git", [
    "-C",
    source,
    "-c",
    "user.name=Portglass packaging check",
    "-c",
    "user.email=packaging-check@localhost",
    "commit",
    "--quiet",
    "-m",
    "Temporary cask validation fixture",
  ]);
  attempted = true;
  run("brew", ["tap", "--custom-remote", name, source]);
  run("ruby", ["-c", join(tap, "Casks/portglass.rb")]);
  run("brew", ["style", "--cask", join(tap, "Casks/portglass.rb")]);
} finally {
  try {
    if (attempted && existsSync(tap)) run("brew", ["untap", name]);
  } finally {
    rmSync(source, { recursive: true, force: true });
  }
}
