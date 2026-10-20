import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  assetName,
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
const config = () =>
  validateConfig(
    JSON.parse(readFileSync(resolve(root, "release.config.json"), "utf8")),
  );
if (process.argv[1] === resolve(import.meta.filename)) {
  const [command, version, directory] = process.argv.slice(2);
  stableVersion(version);
  const settings = config();
  const output = resolve(directory ?? "release-assets");
  if (command === "package") {
    const app = resolve(
      root,
      "src-tauri/target/universal-apple-darwin/release/bundle/macos/Portglass.app",
    );
    if (!process.env.APPLE_TEAM_ID)
      throw new Error("APPLE_TEAM_ID is required before packaging a release");
    verifyMacApp(app, settings, version, process.env.APPLE_TEAM_ID);
    mkdirSync(output, { recursive: true });
    const name = assetName(version);
    const archive = resolve(output, name);
    execFileSync(
      "/usr/bin/ditto",
      ["-c", "-k", "--sequesterRsrc", "--keepParent", app, archive],
      { stdio: "inherit" },
    );
    const bytes = readFileSync(archive);
    const checksum = sha256(bytes);
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const manifest = {
      schemaVersion: 1,
      version,
      repository: settings.repository,
      bundleId: settings.bundleId,
      minimumMacOS: settings.minimumMacOS,
      architectures: ["arm64", "x86_64"],
      notarized: true,
      commit,
      asset: { name, sha256: checksum, bytes: bytes.length },
    };
    writeFileSync(
      resolve(output, "release-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    writeFileSync(resolve(output, "SHA256SUMS"), `${checksum}  ${name}\n`);
    console.log(`Verified and packaged ${name}`);
  } else if (command === "verify") {
    const bytes = readFileSync(resolve(output, assetName(version)));
    validateManifest(
      JSON.parse(
        readFileSync(resolve(output, "release-manifest.json"), "utf8"),
      ),
      { version, config: settings, bytes },
    );
    const unpacked = resolve(output, "verified-app");
    mkdirSync(unpacked, { recursive: true });
    execFileSync("/usr/bin/ditto", [
      "-x",
      "-k",
      resolve(output, assetName(version)),
      unpacked,
    ]);
    verifyMacApp(
      resolve(unpacked, "Portglass.app"),
      settings,
      version,
      process.env.APPLE_TEAM_ID,
    );
    console.log(
      "Release checksum, app identity, universal architectures and notarization verified",
    );
  } else
    throw new Error("Use artifact.mjs package|verify X.Y.Z OUTPUT_DIRECTORY");
}
