import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import { rustEnvironment } from "../rust-env.mjs";
import { stableVersion, validateConfig } from "./core.mjs";
import { notarize, packageDistributions } from "./packaging.mjs";
import { root, verifyProject } from "./project.mjs";

const env = rustEnvironment(root);
const run = (binary, args, options = {}) =>
  execFileSync(binary, args, { cwd: root, env, stdio: "inherit", ...options });
const capture = (binary, args) =>
  run(binary, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
export function doctor() {
  const checks = {};
  for (const [name, binary, args] of [
    ["notarytool", "/usr/bin/xcrun", ["--find", "notarytool"]],
    ["stapler", "/usr/bin/xcrun", ["--find", "stapler"]],
    ["codesign", "/usr/bin/xcrun", ["--find", "codesign"]],
    ["hdiutil", "/usr/bin/xcrun", ["--find", "hdiutil"]],
  ]) {
    try {
      capture(binary, args);
      checks[name] = true;
    } catch {
      checks[name] = false;
    }
  }
  for (const target of ["aarch64-apple-darwin", "x86_64-apple-darwin"]) {
    try {
      const directory = capture("rustc", [
        "--print",
        "target-libdir",
        "--target",
        target,
      ]);
      checks[target] =
        existsSync(directory) &&
        readdirSync(directory).some(
          (name) => name.startsWith("libstd-") && name.endsWith(".rlib"),
        );
    } catch {
      checks[target] = false;
    }
  }
  const identities = capture("/usr/bin/security", [
    "find-identity",
    "-v",
    "-p",
    "codesigning",
  ]);
  checks.developerId = identities.includes('"Developer ID Application:');
  return { checks, identities };
}
if (process.argv[1] === resolve(import.meta.filename)) {
  const [command, value] = process.argv.slice(2);
  if (process.platform !== "darwin")
    throw new Error("Local releases require macOS");
  if (command === "doctor") {
    const status = doctor();
    for (const [name, ready] of Object.entries(status.checks))
      console.log(`${ready ? "OK" : "MISSING"} ${name}`);
    console.log(status.identities);
    console.log("Guide: docs/releases/apple-signing.md");
    process.exitCode = Object.values(status.checks).every(Boolean) ? 0 : 1;
  } else if (command === "build") {
    const version = stableVersion(value);
    verifyProject(`v${version}`);
    const identity = process.env.APPLE_SIGNING_IDENTITY,
      team = process.env.APPLE_TEAM_ID,
      profile = process.env.PORTGLASS_NOTARY_PROFILE ?? "portglass-notary";
    if (
      !identity?.startsWith("Developer ID Application:") ||
      !team ||
      !/^[A-Z0-9]{10}$/.test(team) ||
      !identity.endsWith(`(${team})`)
    )
      throw new Error(
        "Set APPLE_SIGNING_IDENTITY and APPLE_TEAM_ID after installing your Developer ID Application certificate. See docs/releases/apple-signing.md",
      );
    const status = doctor();
    const missing = Object.entries(status.checks)
      .filter(([, ready]) => !ready)
      .map(([name]) => name);
    if (missing.length)
      throw new Error(
        `Missing release prerequisites: ${missing.join(", ")}. See docs/releases/apple-signing.md`,
      );
    if (!status.identities.includes(`"${identity}"`))
      throw new Error(
        "The requested Developer ID identity is not available in your Keychain",
      );
    if (capture("git", ["status", "--porcelain"]))
      throw new Error("Commit or isolate all source changes before releasing");
    const commit = capture("git", ["rev-parse", "HEAD"]);
    if (
      capture("git", ["rev-parse", `refs/tags/v${version}^{commit}`]) !== commit
    )
      throw new Error(
        "Create the stable version tag on the clean release commit before building",
      );
    const output = resolve(root, "release-assets", `v${version}`);
    if (existsSync(output))
      throw new Error(
        "Release directory already exists; preserve published artifacts. Review/remove only an incomplete local attempt before retrying.",
      );
    for (const key of [
      "APPLE_CERTIFICATE",
      "APPLE_CERTIFICATE_PASSWORD",
      "APPLE_ID",
      "APPLE_PASSWORD",
      "APPLE_API_ISSUER",
      "APPLE_API_KEY",
      "APPLE_API_KEY_PATH",
    ])
      delete env[key];
    for (const script of [
      "check",
      "check:rust",
      "test:frontend",
      "test:release",
    ])
      run("npm", ["run", script]);
    run(process.execPath, [
      resolve(root, "scripts/desktop.mjs"),
      "test:core",
      "--lib",
      "--bin",
      "portglass",
    ]);
    run(process.execPath, [
      resolve(root, "scripts/desktop.mjs"),
      "build",
      "--target",
      "universal-apple-darwin",
      "--bundles",
      "app",
      "--ci",
    ]);
    mkdirSync(output, { recursive: true });
    const app = resolve(
      root,
      "src-tauri/target/universal-apple-darwin/release/bundle/macos/Portglass.app",
    );
    const submission = resolve(output, ".notary-app.zip");
    run("/usr/bin/ditto", [
      "-c",
      "-k",
      "--sequesterRsrc",
      "--keepParent",
      app,
      submission,
    ]);
    notarize(submission, profile, resolve(output, ".notary-app.json"));
    run("/usr/bin/xcrun", ["stapler", "staple", app]);
    unlinkSync(submission);
    const config = validateConfig(
      JSON.parse(readFileSync(resolve(root, "release.config.json"), "utf8")),
    );
    packageDistributions(app, config, version, output, {
      identity,
      team,
      profile,
      commit,
    });
    console.log(
      `Signed, notarized DMG, ZIP and TAR.GZ ready in ${output}. Nothing was uploaded.`,
    );
  } else throw new Error("Use local.mjs doctor or build X.Y.Z");
}
