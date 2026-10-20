# Portglass Homebrew cask

`portglass.rb` is created here automatically after the first signed, notarized stable GitHub Release is published. It is intentionally absent until real release bytes and SHA-256 checksums exist. This directory contains no placeholder cask, unsigned artifact or `sha256 :no_check` fallback.

After that release and the **Publish Homebrew cask** workflow succeed:

```sh
brew tap rishitshivesh/portglass https://github.com/rishitshivesh/portglass.git
brew install --cask rishitshivesh/portglass/portglass
```

This project repository is also the custom tap. Updates use this repository's built-in GitHub Actions token; a second tap repository or cross-repository personal token is unnecessary. This is separate from inclusion in Homebrew's centrally maintained cask repository.

Maintainers: see [the release runbook](../docs/releases/README.md).
