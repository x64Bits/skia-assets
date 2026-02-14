# Skia Assets Orchestrator

This repository contains scripts to orchestrate Skia binaries and headers for use in the `zynth-skia` framework.

## Structure

- `input/`: Source files (ignored by git).
  - `binaries/`:
    - `android/`:
      - `arm64-v8a/`: `.a` or `.so` files.
      - `x86_64/`: `.a` or `.so` files.
      - ...
    - `ios/`: `.xcframework` folders.
  - `headers/skia/`: Skia header files.
- `output/`: Generated tarballs ready for GitHub Release (ignored by git).

## Usage

### 1. Fetch Headers (Optional)

If you don't have the headers locally, you can fetch them programmatically from the Skia repository:

```bash
npm run fetch-headers [branch/tag]
# Example: npm run fetch-headers chrome/m142
```

This will populate `input/headers/skia` with `include`, `modules`, and essential `src` headers.

### 2. Prepare Binaries

Place your compiled Skia binaries in the `input/binaries` folder following the structure above.

### 3. Package Assets

Once `input/` is populated, run the packaging script:

```bash
npm run package <version-tag>
# Example: npm run package skia-graphite-m142b
```

The script will:
- Map Android architectures to the expected naming convention (`arm64-v8a` -> `arm-64`, etc.).
- Create `.tar.gz` archives in the `output/` folder.
- Calculate SHA256 checksums for all archives.
- Generate a `release-manifest.json` in `output/` with all checksums.

### 4. Create a Release

1. Create a new Tag/Release in GitHub.
2. Upload the `.tar.gz` files from the `output/` folder to the release.
3. Update the `binaries.manifest.json` in `zynth-skia` with the new URLs and checksums.

## Development

The scripts are located in the `scripts/` folder:
- `package-assets.mjs`: Main orchestration script.
- `fetch-headers.mjs`: Utility to download headers from googlesource.
