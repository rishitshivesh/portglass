import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compareVersions, stableVersion, versionFromTag } from "./core.mjs";
export const root = resolve(import.meta.dirname, "../..");
const paths = [
  "package.json",
  "package-lock.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
];
export function projectVersions(files) {
  const pkg = JSON.parse(files["package.json"]),
    lock = JSON.parse(files["package-lock.json"]),
    tauri = JSON.parse(files["src-tauri/tauri.conf.json"]);
  const cargo = files["src-tauri/Cargo.toml"].match(
    /\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/,
  );
  const cargoLock = files["src-tauri/Cargo.lock"].match(
    /\[\[package\]\]\nname = "portglass"\nversion = "([^"]+)"/,
  );
  if (!cargo || !cargoLock)
    throw new Error("Portglass package is missing from Cargo manifests");
  return [
    pkg.version,
    lock.version,
    lock.packages?.[""]?.version,
    tauri.version,
    cargo[1],
    cargoLock[1],
  ];
}
export function readProject() {
  return Object.fromEntries(
    paths.map((path) => [path, readFileSync(resolve(root, path), "utf8")]),
  );
}
export function verifyProject(tag, files = readProject()) {
  const version = versionFromTag(tag);
  if (!projectVersions(files).every((value) => value === version))
    throw new Error(
      "Tag, npm, Tauri, Cargo and both lockfile versions must match",
    );
  return version;
}
export function bumpFiles(files, nextVersion) {
  const version = stableVersion(nextVersion);
  const old = projectVersions(files);
  if (!old.every((value) => value === old[0]))
    throw new Error("Fix existing version drift before bumping");
  if (compareVersions(version, old[0]) <= 0)
    throw new Error("The next release version must increase");
  const changed = { ...files };
  for (const path of [
    "package.json",
    "package-lock.json",
    "src-tauri/tauri.conf.json",
  ]) {
    const value = JSON.parse(files[path]);
    value.version = version;
    if (path === "package-lock.json") value.packages[""].version = version;
    changed[path] = `${JSON.stringify(value, null, 2)}\n`;
  }
  // Match only this package; dependency versions stay pinned.
  changed["src-tauri/Cargo.toml"] = files["src-tauri/Cargo.toml"].replace(
    /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+(")/,
    (_, a, b) => `${a}${version}${b}`,
  );
  changed["src-tauri/Cargo.lock"] = files["src-tauri/Cargo.lock"].replace(
    /(\[\[package\]\]\nname = "portglass"\nversion = ")[^"]+(")/,
    (_, a, b) => `${a}${version}${b}`,
  );
  verifyProject(`v${version}`, changed);
  return changed;
}
if (process.argv[1] === resolve(import.meta.filename)) {
  const [command, value] = process.argv.slice(2);
  if (command === "verify") console.log(`Verified v${verifyProject(value)}`);
  else if (command === "bump") {
    for (const [path, text] of Object.entries(bumpFiles(readProject(), value)))
      writeFileSync(resolve(root, path), text);
    console.log(
      `Set all application versions to ${value}. Review, commit, then tag.`,
    );
  } else throw new Error("Use project.mjs verify vX.Y.Z or bump X.Y.Z");
}
