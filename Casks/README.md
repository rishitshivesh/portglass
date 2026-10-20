# Portglass Homebrew cask

`portglass.rb` is created here by the local release command after the first signed, notarized stable GitHub Release is published. It is intentionally absent until real release bytes and SHA-256 checksums exist. This directory contains no placeholder cask, unsigned artifact or `sha256 :no_check` fallback.

After that release and the local cask synchronization succeed:

```sh
brew tap rishitshivesh/portglass https://github.com/rishitshivesh/portglass.git
brew install --cask rishitshivesh/portglass/portglass
```

This project repository is also the custom tap. Updates use your existing local GitHub CLI authentication; no Actions workflow, second tap repository or cross-repository token is needed. This is separate from inclusion in Homebrew's centrally maintained cask repository.

Maintainers: see [the release runbook](../docs/releases/README.md).
