# Apple signing setup on your Mac

Portglass is a Tauri/Rust app. You can use Xcode to manage the Apple account and signing certificate; the release command builds the application with Rust and uses Apple's command-line signing/notarization tools. You do not need to convert it into an Xcode project.

## What you need

1. An active Apple Developer Program membership with access to create/use a Developer ID certificate. Enrollment and any membership payment are completed by you through Apple. [Apple enrollment](https://developer.apple.com/programs/enroll/)
2. A **Developer ID Application** certificate and its matching private key in your Mac's Keychain. This certificate signs apps distributed outside the Mac App Store. The Developer ID Installer certificate is for installer packages; the DMG/ZIP/TAR flow here uses Developer ID Application. [Apple certificate guide](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)
3. Apple's `codesign`, `notarytool`, `stapler` and `hdiutil` tools. The current machine already resolves these through its installed Command Line Tools. Full Xcode is useful for certificate management but a Tauri build is driven by the CLI.

## Create or install the certificate

In Xcode's Settings, open the Apple account/accounts pane, add your Apple account if necessary, select your developer team and open **Manage Certificates**. Use the add button to create **Developer ID Application**. Pane labels vary between Xcode versions. Apple documents the certificate manager in its [Xcode certificate guide](https://help.apple.com/xcode/mac/current/en.lproj/dev154b28f09.html).

Alternatively, use the Apple Developer account website: Certificates, Identifiers & Profiles → Certificates → add → Developer ID → Developer ID Application. Follow Apple's CSR instructions, download the certificate and double-click it to install it in Keychain Access. Apple documents Account Holder requirements and cloud-managed alternatives in the certificate guide above. A team administrator may need to arrange access for you.

In Keychain Access → My Certificates, your identity must have its matching private key. Importing a `.cer` from someone else's Mac does not bring their private key with it. For an existing team certificate, coordinate with its owner using Apple's documented export/import process. You do not need to export a `.p12` or send your key to GitHub for this local release flow.

Verify the installed identity in Terminal:

```sh
security find-identity -v -p codesigning
```

Copy the exact **Developer ID Application** identity shown, including its team suffix. The most recent local check found zero valid identities, so certificate setup remains outstanding. This does not determine whether your Apple account has a membership.

## Store notarization credentials locally

Apple notarization checks the signed app and issues a ticket. It is separate from code signing and from App Store review. This release flow submits the app, staples its ticket, then signs/notarizes/staples the outer DMG. ZIP and TAR contain the already-stapled application.

Create an Apple app-specific password through your Apple account if using Apple ID authentication. Then run:

```sh
xcrun notarytool store-credentials portglass-notary
```

The installed command supports interactive prompts. Enter your Apple account email, team ID and **app-specific password** in the prompts. Do not put the password in shell history, source files or chat. The profile is stored in Keychain. Apple also supports App Store Connect API credentials; this helper can use any valid stored profile. [Apple notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)

Set these non-password values in the Terminal used for releases:

```sh
export APPLE_SIGNING_IDENTITY='Developer ID Application: Your Name (YOURTEAMID)'
export APPLE_TEAM_ID='YOURTEAMID'
export PORTGLASS_NOTARY_PROFILE='portglass-notary'
```

Replace the example identity/team with the real values. No Apple credentials or signing secrets are needed in GitHub. Keychain may request access when `codesign` uses your private key; review those normal macOS prompts yourself.

## Prepare both Rust targets

Run:

```sh
npm run release:doctor
```

Universal packaging requires `aarch64-apple-darwin` and `x86_64-apple-darwin` standard libraries in the selected Rust toolchain. With a Rustup-managed installation:

```sh
rustup target add --toolchain stable aarch64-apple-darwin x86_64-apple-darwin
```

The current checkout can find an existing stable Rust toolchain even though the usual Rustup command/shims are absent. Its Intel target is missing. Restore/install the official Rustup manager for that toolchain, or supply a standard Rustup installation with both targets, before building the universal release. The helper does not silently alter your global toolchain or shell settings. [Official Rust target management](https://rust-lang.github.io/rustup/cross-compilation.html)

When the doctor reports all prerequisites present, follow the [local release runbook](README.md). Do not publish an unsigned/ad-hoc build as a fallback.
