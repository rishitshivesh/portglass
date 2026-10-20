import { createHash } from "node:crypto";
export function stableVersion(value) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)
  )
    throw new Error("Expected a stable version such as 0.1.0");
  return value;
}
export function versionFromTag(tag) {
  if (typeof tag !== "string" || !tag.startsWith("v"))
    throw new Error("Release tags must start with v");
  return stableVersion(tag.slice(1));
}
export function compareVersions(left, right) {
  const a = stableVersion(left).split(".").map(BigInt),
    b = stableVersion(right).split(".").map(BigInt);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}
export function validateConfig(config) {
  if (
    typeof config.repository !== "string" ||
    config.repository !== config.repository.trim() ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository) ||
    config.appName !== "Portglass" ||
    config.bundleId !== "dev.portglass.desktop" ||
    config.minimumMacOS !== "12.0"
  )
    throw new Error("Invalid release configuration");
  return config;
}
export const assetName = (version) =>
  `Portglass-${stableVersion(version)}-universal-macos.zip`;
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export function validateManifest(manifest, { version, config, bytes }) {
  validateConfig(config);
  stableVersion(version);
  if (
    manifest.schemaVersion !== 1 ||
    manifest.version !== version ||
    manifest.repository !== config.repository ||
    manifest.bundleId !== config.bundleId ||
    manifest.notarized !== true ||
    manifest.minimumMacOS !== config.minimumMacOS ||
    !Array.isArray(manifest.architectures) ||
    [...manifest.architectures].sort().join(",") !== "arm64,x86_64" ||
    !/^[a-f0-9]{40}$/.test(manifest.commit) ||
    manifest.asset?.name !== assetName(version) ||
    manifest.asset?.sha256 !== sha256(bytes) ||
    manifest.asset?.bytes !== bytes.length
  )
    throw new Error(
      "Release manifest, signing status or artifact checksum does not match",
    );
  return manifest;
}
export function renderCask(version, checksum, config) {
  stableVersion(version);
  validateConfig(config);
  if (
    typeof checksum !== "string" ||
    checksum.length !== 64 ||
    !/^[a-f0-9]{64}$/.test(checksum)
  )
    throw new Error("A real SHA-256 checksum is required");
  return `cask "portglass" do
  version "${version}"
  sha256 "${checksum}"

  url "https://github.com/${config.repository}/releases/download/v#{version}/Portglass-#{version}-universal-macos.zip"
  name "Portglass"
  desc "Visibility into local developer resources and AI agent processes"
  homepage "https://github.com/${config.repository}"

  depends_on macos: :monterey

  app "Portglass.app"

  uninstall quit: "${config.bundleId}"

  zap trash: "~/Library/Caches/${config.bundleId}"
end
`;
}
export function assertPublishedRelease(release, tag) {
  versionFromTag(tag);
  if (
    !release ||
    release.tag_name !== tag ||
    release.draft !== false ||
    release.prerelease !== false ||
    !release.published_at
  )
    throw new Error(
      "Only the latest published stable release can update Homebrew",
    );
}
