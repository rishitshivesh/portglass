# Install Portglass

Portglass supports macOS. Signed releases will contain one universal app for Apple Silicon and Intel, with a configured minimum of macOS 12. Actual hardware/OS validation is recorded per release.

**The first signed release has not been published yet.** These installation commands become usable after local release publication and cask synchronization succeed. Until then, use the development instructions in the root README.

## Homebrew

```sh
brew tap rishitshivesh/portglass https://github.com/rishitshivesh/portglass.git
brew install --cask rishitshivesh/portglass/portglass
```

Launch Portglass from Applications. This is the maintainer's custom tap, separate from Homebrew's central cask repository.

To upgrade, quit the running Portglass using its app/tray Quit action, then:

```sh
brew update
brew upgrade --cask rishitshivesh/portglass/portglass
```

Open it again to load the updated version. A normal close hides the window; it does not quit. Launching another copy activates the existing instance on the same macOS account.

## Direct GitHub downloads

From [GitHub Releases](https://github.com/rishitshivesh/portglass/releases), choose a published stable release:

- **DMG:** open the disk image and drag Portglass.app to the Applications shortcut. Eject the disk image, then open the app from Applications.
- **ZIP:** extract and move Portglass.app to Applications.
- **TAR.GZ:** extract the archive and move Portglass.app to Applications.

All formats carry the same signed/notarized universal application. SHA256SUMS and release-manifest.json describe all downloads. To check a DMG, for example:

```sh
shasum -a 256 Portglass-X.Y.Z-universal-macos.dmg
```

Compare with SHA256SUMS. The local release process verifies Developer ID signing, Apple notarization and stapled tickets before upload. If macOS rejects an official release, verify its source/checksum and report the version and exact warning. Do not disable Gatekeeper, strip quarantine or use sudo as an installation workaround.

## Permissions and data

No administrator, Accessibility or screen-recording permission is requested for Portglass's implemented observation/focus features. Native folder selection scopes a custom scan. Common developer-location scans and local engine discovery run only when requested. Docker-compatible runtimes must already be installed and running; Portglass does not install/start them or change the active context.

Local scan metadata is bounded and stored in `~/Library/Caches/dev.portglass.desktop`; use Storage → Clear scan cache to remove it. Processes, transcripts and provider sessions are not persisted. Resource cleanup is distinct from app uninstallation and requires its own review/confirmation.

## Uninstall

```sh
brew uninstall --cask rishitshivesh/portglass/portglass
```

Normal uninstall removes the app and preserves cached scan metadata. To also remove Portglass's cache:

```sh
brew uninstall --cask --zap rishitshivesh/portglass/portglass
```

The cask's zap target is only Portglass's own cache directory. It does not remove projects, node_modules, Python environments, build outputs, Docker data or other developer resources.
