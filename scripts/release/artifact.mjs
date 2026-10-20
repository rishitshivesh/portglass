import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import {
  assetName,
  distributionNames,
  sha256,
  stableVersion,
  validateConfig,
  validateManifest,
} from "./core.mjs";
import { root } from "./project.mjs";
export function verifyMacApp(appPath, config, version, expectedTeam) {
  validateConfig(config);
  stableVersion(version);
  const run = (binary, args) =>
    execFileSync(binary, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const plist = resolve(appPath, "Contents/Info.plist");
  if (
    basename(appPath) !== "Portglass.app" ||
    run("/usr/libexec/PlistBuddy", [
      "-c",
      "Print :CFBundleIdentifier",
      plist,
    ]) !== config.bundleId ||
    run("/usr/libexec/PlistBuddy", [
      "-c",
      "Print :CFBundleShortVersionString",
      plist,
    ]) !== version ||
    run("/usr/libexec/PlistBuddy", [
      "-c",
      "Print :LSMinimumSystemVersion",
      plist,
    ]) !== config.minimumMacOS
  )
    throw new Error("App identity/version/minimum OS differs from the release");
  const archs = run("/usr/bin/lipo", [
    "-archs",
    resolve(appPath, "Contents/MacOS/portglass"),
  ])
    .split(/\s+/)
    .sort();
  if (archs.join(",") !== "arm64,x86_64")
    throw new Error(
      "The release must contain Apple Silicon and Intel binaries",
    );
  run("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath]);
  // Gatekeeper verifies the Developer ID/notarization chain, and stapler checks
  // offline ticket availability. Ad-hoc/local debug builds fail these gates.
  run("/usr/sbin/spctl", [
    "--assess",
    "--type",
    "execute",
    "--verbose=2",
    appPath,
  ]);
  run("/usr/bin/xcrun", ["stapler", "validate", appPath]);
  if (expectedTeam) {
    const requirement = `anchor apple generic and identifier "${config.bundleId}" and certificate leaf[subject.OU] = "${expectedTeam}"`;
    if (!/^[A-Z0-9]{10}$/.test(expectedTeam))
      throw new Error("Invalid Apple team ID");
    run("/usr/bin/codesign", ["--verify", "-R", requirement, appPath]);
  }
}
export function verifyReleaseFiles(directory, config, version) {
  const manifest = JSON.parse(
    readFileSync(resolve(directory, "release-manifest.json"), "utf8"),
  );
  validateManifest(manifest, {
    version,
    config,
    bytes: readFileSync(resolve(directory, assetName(version))),
  });
  for (const name of distributionNames(version)) {
    const entry = manifest.distributions.find((entry) => entry.name === name);
    const bytes = readFileSync(resolve(directory, name));
    if (entry.sha256 !== sha256(bytes) || entry.bytes !== bytes.length)
      throw new Error(`Distribution checksum mismatch: ${name}`);
  }
  const checksumLines = distributionNames(version)
    .map(
      (name) =>
        `${manifest.distributions.find((entry) => entry.name === name).sha256}  ${name}`,
    )
    .join("\n");
  const checksumList = `${checksumLines}\n`;
  if (readFileSync(resolve(directory, "SHA256SUMS"), "utf8") !== checksumList)
    throw new Error("SHA256SUMS does not match the verified manifest");
  return manifest;
}
export function verifyDistributions(directory, config, version, expectedTeam) {
  const manifest = verifyReleaseFiles(directory, config, version);
  const temp = mkdtempSync(resolve(tmpdir(), "portglass-verify-"));
  try {
    for (const name of distributionNames(version).slice(0, 2)) {
      const output = resolve(temp, name.endsWith(".zip") ? "zip" : "tar");
      if (name.endsWith(".zip"))
        execFileSync("/usr/bin/ditto", [
          "-x",
          "-k",
          resolve(directory, name),
          output,
        ]);
      else {
        mkdirSync(output, { recursive: true });
        execFileSync("/usr/bin/tar", [
          "-xzf",
          resolve(directory, name),
          "-C",
          output,
        ]);
      }
      verifyMacApp(
        resolve(output, "Portglass.app"),
        config,
        version,
        expectedTeam,
      );
    }
    const dmg = resolve(directory, distributionNames(version)[2]);
    execFileSync("/usr/bin/codesign", ["--verify", "--strict", dmg]);
    execFileSync("/usr/bin/xcrun", ["stapler", "validate", dmg], {
      stdio: "inherit",
    });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  return manifest;
}
if (process.argv[1] === resolve(import.meta.filename)) {
  const [command, version, directory] = process.argv.slice(2);
  if (command !== "verify")
    throw new Error("Use artifact.mjs verify X.Y.Z OUTPUT_DIRECTORY");
  const config = validateConfig(
    JSON.parse(readFileSync(resolve(root, "release.config.json"), "utf8")),
  );
  verifyDistributions(
    resolve(directory ?? "release-assets"),
    config,
    stableVersion(version),
    process.env.APPLE_TEAM_ID,
  );
  console.log(
    "All distribution checksums, application signatures and notarization verified",
  );
}
