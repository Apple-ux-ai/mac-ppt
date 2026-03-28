# Mac build notes

This package is prepared for building the app on a macOS machine.

## Why a separate mac config exists

- The current project bundles Windows-only `LibreOffice`, `ImageMagick`, and `Ghostscript` files under `resources/`.
- Those binaries cannot run on macOS.
- `electron-builder.mac.yml` excludes those Windows resources so the app can still be packaged on macOS.

## What to install on the Mac first

1. Node.js 20 or later
2. Xcode Command Line Tools
3. Homebrew
4. Runtime tools used by the app:

```bash
brew install libreoffice imagemagick ghostscript
```

## Build steps on the Mac

```bash
npm install
npx electron-builder --config electron-builder.mac.yml --mac dmg zip
```

Build output will be written to `release-mac/`.

## Important note

The mac package will rely on the system-installed `LibreOffice`, `ImageMagick`, and `Ghostscript` above instead of the Windows binaries in this repository.
