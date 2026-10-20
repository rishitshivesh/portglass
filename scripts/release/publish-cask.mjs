import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertPublishedRelease,
  assetName,
  compareVersions,
  renderCask,
  validateConfig,
  validateManifest,
  versionFromTag,
} from "./core.mjs";
import { root } from "./project.mjs";

const [tag, directory, dryRun] = process.argv.slice(2);
const version = versionFromTag(tag);
const config = validateConfig(
  JSON.parse(readFileSync(resolve(root, "release.config.json"), "utf8")),
);
const manifest = JSON.parse(
  readFileSync(resolve(directory, "release-manifest.json"), "utf8"),
);
validateManifest(manifest, {
  version,
  config,
  bytes: readFileSync(resolve(directory, assetName(version))),
});
const cask = renderCask(version, manifest.asset.sha256, config);
writeFileSync(resolve(directory, "portglass.rb"), cask);
if (dryRun !== "--publish") {
  console.log("Generated verified portglass.rb; no repository changes made");
  process.exit(0);
}
const request = async (path, options = {}) => {
  const endpoint = `repos/${config.repository}${path ? `/${path}` : ""}`;
  const args = [
    "api",
    "--hostname",
    "github.com",
    endpoint,
    "--method",
    options.method ?? "GET",
  ];
  if (options.body) args.push("--input", "-");
  try {
    return JSON.parse(
      execFileSync("gh", args, {
        input: options.body,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }),
    );
  } catch (error) {
    if (String(error.stderr).includes("HTTP 404")) return null;
    throw new Error(
      "GitHub request failed. Check gh auth status, repository access and branch rules.",
    );
  }
};
// Reject delayed events and prereleases: only the current latest stable release
// can advance the tap, and an older version cannot overwrite a newer cask.
assertPublishedRelease(await request("releases/latest"), tag);
const repository = await request("");
const branch = repository.default_branch;
const previous = await request(
  `contents/Casks/portglass.rb?ref=${encodeURIComponent(branch)}`,
);
if (previous) {
  const text = Buffer.from(previous.content, "base64").toString("utf8");
  const old = text.match(/\bversion "([^"]+)"/);
  if (!old) throw new Error("Existing cask version cannot be verified");
  if (compareVersions(version, old[1]) < 0)
    throw new Error("Refusing to downgrade the Homebrew cask");
  if (version === old[1]) {
    if (text !== cask)
      throw new Error(
        "Published release checksum cannot be replaced for the same version",
      );
    console.log("Cask already current");
    process.exit(0);
  }
}
const result = await request("contents/Casks/portglass.rb", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: `chore(homebrew): release Portglass ${version}`,
    content: Buffer.from(cask).toString("base64"),
    branch,
    ...(previous ? { sha: previous.sha } : {}),
  }),
});
if (!result) throw new Error("Cask publication failed");
console.log(result.commit.html_url);
