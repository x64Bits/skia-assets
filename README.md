# Zynth Build Assets Orchestrator

This repository is the central provider of compiled binaries and headers for the Zynth framework (Skia, Yoga, and other future dependencies). It contains scripts to automate fetching, building, and packaging these assets for various platforms (Android, iOS).

## Structure

- `input/`: Source files (ignored by git).
  - `binaries/`:
    - `android/`: Skia `.tar.gz` archives per architecture.
    - `ios/`: Skia `.xcframework` folders.
    - `yoga/android/`: Built `libyoga.so` files per architecture.
  - `headers/`:
    - `skia/`: Skia header files.
    - `yoga/`: Yoga header files.
- `output/`: Generated tarballs ready for GitHub Release (ignored by git).

## Usage

### 1. Skia Headers & Binaries

If you don't have the Skia headers locally, fetch them from the source:
```bash
npm run fetch-headers [branch/tag]
# Example: npm run fetch-headers chrome/m142
```
This populates `input/headers/skia`. Place your compiled Skia binaries in `input/binaries/android/` or `input/binaries/ios/`.

### 2. Yoga (Build & Update)

To build Facebook's Yoga library from source for Android architectures:
```bash
npm run update-yoga [version]
# Example: npm run update-yoga 3.2.1
```
This script will:
- Download the Yoga source code.
- Patch the build system for shared library support.
- Compile `libyoga.so` for `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64` using the Android NDK.
- Populate `input/binaries/yoga/android/` and `input/headers/yoga/`.

### 3. Package Assets

Once `input/` is populated with Skia and/or Yoga files, run the packaging script:
```bash
npm run package <version-tag>
# Example: npm run package v0.0.3
```
The script will:
- Map Android architectures to the expected naming convention (e.g., `arm64-v8a` -> `arm-64`).
- Create `.tar.gz` archives in the `output/` folder for all available assets.
- Calculate SHA256 checksums for all archives.
- Generate a `release-manifest.json` in `output/` with all checksums.

### 4. Create a Release

1. Create a new Tag/Release in GitHub.
2. Upload the `.tar.gz` files from the `output/` folder to the release.
3. Update the `binaries.manifest.json` in your framework project with the new URLs and checksums.

## Development

The scripts are located in the `scripts/` folder:
- `package-assets.mjs`: Main orchestration script (packages both Skia and Yoga).
- `update-yoga.mjs`: Automated Yoga build system for Android.
- `fetch-headers.mjs`: Utility to download Skia headers from googlesource.
