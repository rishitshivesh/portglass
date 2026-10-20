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
if (!process.env.GH_TOKEN)
  throw new Error(
    "A repository-scoped GitHub token is required to publish the cask",
  );
const request = async (path, options = {}) => {
  const response = await fetch(
    `https://api.github.com/repos/${config.repository}/${path}`,
    {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...options.headers,
      },
    },
  );
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(
      `GitHub ${response.status}: cask publication failed; check workflow permissions and branch rules`,
    );
  return response.json();
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
