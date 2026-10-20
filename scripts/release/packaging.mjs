import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { verifyDistributions, verifyMacApp } from "./artifact.mjs";
import { distributionNames, sha256 } from "./core.mjs";
export function notarize(file, profile, receipt) {
  const output = execFileSync(
    "/usr/bin/xcrun",
    [
      "notarytool",
      "submit",
      file,
      "--keychain-profile",
      profile,
      "--wait",
      "--output-format",
      "json",
    ],
    { encoding: "utf8", maxBuffer: 4_000_000 },
  );
  writeFileSync(receipt, output, { mode: 0o600 });
  const result = JSON.parse(output);
  if (result.status !== "Accepted")
    throw new Error(
      `Apple notarization ${result.status ?? "failed"}. See local receipt ${receipt}; do not publish.`,
    );
  console.log(`Apple accepted ${basename(file)} (${result.id})`);
}
export function createDmg(app, output) {
  const stage = mkdtempSync(join(tmpdir(), "portglass-dmg-"));
  try {
    execFileSync("/usr/bin/ditto", [app, join(stage, "Portglass.app")]);
    symlinkSync("/Applications", join(stage, "Applications"));
    execFileSync(
      "/usr/bin/hdiutil",
      [
        "create",
        "-volname",
        "Portglass",
        "-srcfolder",
        stage,
        "-format",
        "UDZO",
        output,
      ],
      { stdio: "inherit" },
    );
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
export function packageDistributions(
  app,
  config,
  version,
  directory,
  { identity, team, profile, commit },
) {
  verifyMacApp(app, config, version, team);
  const [zipName, tarName, dmgName] = distributionNames(version);
  execFileSync(
    "/usr/bin/ditto",
    [
      "-c",
      "-k",
      "--sequesterRsrc",
      "--keepParent",
      app,
      resolve(directory, zipName),
    ],
    { stdio: "inherit" },
  );
  execFileSync(
    "/usr/bin/tar",
    ["-czf", resolve(directory, tarName), "-C", dirname(app), "Portglass.app"],
    { stdio: "inherit" },
  );
  const dmg = resolve(directory, dmgName);
  createDmg(app, dmg);
  execFileSync(
    "/usr/bin/codesign",
    ["--force", "--sign", identity, "--timestamp", dmg],
    { stdio: "inherit" },
  );
  notarize(dmg, profile, resolve(directory, ".notary-dmg.json"));
  execFileSync("/usr/bin/xcrun", ["stapler", "staple", dmg], {
    stdio: "inherit",
  });
  const distributions = distributionNames(version).map((name) => {
    const bytes = readFileSync(resolve(directory, name));
    return { name, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const manifest = {
    schemaVersion: 2,
    version,
    repository: config.repository,
    bundleId: config.bundleId,
    minimumMacOS: config.minimumMacOS,
    architectures: ["arm64", "x86_64"],
    notarized: true,
    commit,
    asset: distributions[0],
    distributions,
  };
  writeFileSync(
    resolve(directory, "release-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeFileSync(
    resolve(directory, "SHA256SUMS"),
    distributions.map((entry) => `${entry.sha256}  ${entry.name}`).join("\n") +
      "\n",
  );
  verifyDistributions(directory, config, version, team);
  return manifest;
}
