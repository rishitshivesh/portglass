import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { verifyReleaseFiles } from "./artifact.mjs";
import {
  assertPublishedRelease,
  assetName,
  compareVersions,
  distributionNames,
  renderCask,
  sha256,
  validateManifest,
  versionFromTag,
} from "./core.mjs";
import { bumpFiles, readProject, verifyProject } from "./project.mjs";

const config = {
  repository: "rishitshivesh/portglass",
  bundleId: "dev.portglass.desktop",
  appName: "Portglass",
  minimumMacOS: "12.0",
};
const bytes = Buffer.from("fixture archive");
const manifest = {
  schemaVersion: 2,
  version: "0.1.0",
  repository: config.repository,
  bundleId: config.bundleId,
  minimumMacOS: "12.0",
  architectures: ["arm64", "x86_64"],
  notarized: true,
  distributions: distributionNames("0.1.0").map((name) => ({
    name,
    sha256: sha256(bytes),
    bytes: bytes.length,
  })),
  commit: "a".repeat(40),
  asset: {
    name: assetName("0.1.0"),
    sha256: sha256(bytes),
    bytes: bytes.length,
  },
};
test("release tags reject prereleases and shell/ref injection", () => {
  for (const tag of [
    "v0.1.0-beta.1",
    "main",
    "v01.0.0",
    "v1.0.0\nmain",
    "v1.0.0\n",
    "v1.0.0;echo bad",
  ])
    assert.throws(() => versionFromTag(tag));
  assert.equal(versionFromTag("v0.1.0"), "0.1.0");
});
test("only complete notarized universal archives with matching bytes can generate a cask", () => {
  assert.equal(
    validateManifest(manifest, { version: "0.1.0", config, bytes }),
    manifest,
  );
  for (const modified of [
    { ...manifest, notarized: false },
    { ...manifest, architectures: ["arm64"] },
    { ...manifest, distributions: manifest.distributions.slice(0, 2) },
    { ...manifest, asset: { ...manifest.asset, sha256: "0".repeat(64) } },
  ])
    assert.throws(() =>
      validateManifest(modified, { version: "0.1.0", config, bytes }),
    );
  assert.match(
    renderCask("0.1.0", sha256(bytes), config),
    /Portglass-#\{version\}-universal-macos.zip/,
  );
  assert.throws(() => renderCask("0.1.0", ":no_check", config));
});
test("published-release gate rejects drafts, prereleases and delayed events", () => {
  const release = {
    tag_name: "v0.1.0",
    draft: false,
    prerelease: false,
    published_at: "2026-10-20",
  };
  assertPublishedRelease(release, "v0.1.0");
  for (const changed of [
    { ...release, draft: true },
    { ...release, prerelease: true },
    { ...release, tag_name: "v0.2.0" },
  ])
    assert.throws(() => assertPublishedRelease(changed, "v0.1.0"));
  assert.equal(compareVersions("0.10.0", "0.9.0"), 1);
});
test("version bump updates all manifests and lockfiles and rejects drift/downgrades", () => {
  const files = readProject();
  const version = JSON.parse(files["package.json"]).version;
  verifyProject(`v${version}`, files);
  const changed = bumpFiles(files, "99.0.0");
  assert.equal(verifyProject("v99.0.0", changed), "99.0.0");
  assert.throws(() => bumpFiles(files, "0.0.0"));
  assert.throws(() => verifyProject("v99.0.0", files));
  assert.notEqual(
    files["src-tauri/Cargo.lock"],
    changed["src-tauri/Cargo.lock"],
  );
});

test("tar and DMG are required and independently hashed before distribution", () => {
  const directory = mkdtempSync(join(tmpdir(), "portglass-manifest-test-"));
  try {
    for (const name of distributionNames("0.1.0"))
      writeFileSync(join(directory, name), bytes);
    writeFileSync(
      join(directory, "release-manifest.json"),
      JSON.stringify(manifest),
    );
    const checksumLines = distributionNames("0.1.0")
      .map((name) => `${sha256(bytes)}  ${name}`)
      .join("\n");
    const checksums = `${checksumLines}\n`;
    writeFileSync(join(directory, "SHA256SUMS"), checksums);
    assert.equal(
      verifyReleaseFiles(directory, config, "0.1.0").version,
      "0.1.0",
    );
    writeFileSync(
      join(directory, distributionNames("0.1.0")[1]),
      "modified tar archive",
    );
    assert.throws(
      () => verifyReleaseFiles(directory, config, "0.1.0"),
      /checksum mismatch/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
