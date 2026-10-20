import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyDistributions } from "./artifact.mjs";
import {
  compareVersions,
  distributionNames,
  stableVersion,
  validateConfig,
  versionFromTag,
} from "./core.mjs";
import { root } from "./project.mjs";

const [command, input] = process.argv.slice(2);
if (!["upload", "publish", "cask"].includes(command))
  throw new Error("Use github.mjs upload|publish|cask X.Y.Z");
const version = stableVersion(input),
  tag = `v${version}`;
const config = validateConfig(
  JSON.parse(readFileSync(resolve(root, "release.config.json"), "utf8")),
);
const output = resolve(root, "release-assets", tag);
const run = (binary, args, options = {}) =>
  execFileSync(binary, args, { cwd: root, stdio: "inherit", ...options });
const capture = (binary, args) =>
  run(binary, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const manifest = verifyDistributions(
  output,
  config,
  version,
  process.env.APPLE_TEAM_ID,
);
if (command === "upload") {
  const commit = capture("git", ["rev-parse", `refs/tags/${tag}^{commit}`]);
  if (manifest.commit !== commit)
    throw new Error(
      "Release archive and version tag identify different source commits",
    );
  const remote = capture("git", ["remote", "get-url", "origin"]);
  if (
    ![
      `https://github.com/${config.repository}`,
      `https://github.com/${config.repository}.git`,
      `git@github.com:${config.repository}.git`,
    ].includes(remote)
  )
    throw new Error("origin does not match the configured release repository");
  run("git", ["push", "origin", `refs/tags/${tag}`]);
  let existing = null;
  try {
    existing = JSON.parse(
      capture("gh", [
        "release",
        "view",
        tag,
        "--repo",
        config.repository,
        "--json",
        "isDraft",
      ]),
    );
  } catch {}
  if (existing && !existing.isDraft)
    throw new Error(
      "Published releases cannot be overwritten; create a new patch version",
    );
  if (!existing)
    run("gh", [
      "release",
      "create",
      tag,
      "--repo",
      config.repository,
      "--verify-tag",
      "--draft",
      "--title",
      `Portglass ${version}`,
      "--generate-notes",
      "--notes-file",
      resolve(root, "docs/releases/release-notes.md"),
    ]);
  run("gh", [
    "release",
    "upload",
    tag,
    "--repo",
    config.repository,
    ...distributionNames(version).map((name) => resolve(output, name)),
    resolve(output, "SHA256SUMS"),
    resolve(output, "release-manifest.json"),
  ]);
  console.log("Uploaded a GitHub draft. Review and test it before publishing.");
} else {
  run(process.execPath, [
    resolve(root, "scripts/release/publish-cask.mjs"),
    tag,
    output,
  ]);
  run(process.execPath, [
    resolve(root, "scripts/release/check-cask.mjs"),
    resolve(output, "portglass.rb"),
  ]);
  if (command === "publish") {
    let latest = null;
    try {
      latest = capture("gh", [
        "api",
        `repos/${config.repository}/releases/latest`,
        "--jq",
        ".tag_name",
      ]);
    } catch (error) {
      if (!String(error.stderr).includes("HTTP 404")) throw error;
    }
    if (latest && compareVersions(version, versionFromTag(latest)) < 0)
      throw new Error(
        "Refusing to make an older version the latest public release",
      );
    run("gh", [
      "release",
      "edit",
      tag,
      "--repo",
      config.repository,
      "--draft=false",
      "--latest",
    ]);
  }
  run(process.execPath, [
    resolve(root, "scripts/release/publish-cask.mjs"),
    tag,
    output,
    "--publish",
  ]);
  console.log(
    "Homebrew synchronized using local GitHub CLI authentication. No Actions workflow was used.",
  );
}
