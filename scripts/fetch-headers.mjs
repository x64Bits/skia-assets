import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ANSI Colors
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const BRIGHT = '\x1b[1m';

const SYMBOL_STEP = `${GREEN}◆${RESET}`;
const SYMBOL_SUCCESS = `${GREEN}✔${RESET}`;
const SYMBOL_SUBSTEP = `${GREEN}➔${RESET}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const inputHeadersDir = path.join(rootDir, 'input', 'headers', 'skia');

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function fetchTarball(url, destDir) {
  process.stdout.write(`  ${SYMBOL_SUBSTEP} Fetching: ${DIM}${path.basename(destDir)}${RESET}... `);
  await ensureDir(destDir);
  const tempFile = path.join(destDir, 'temp.tar.gz');
  
  try {
    // Silent fetch
    execSync(`curl -sL "${url}" -o "${tempFile}"`);
    execSync(`tar -xzf "${tempFile}" -C "${destDir}"`);
    process.stdout.write(`${GREEN}done${RESET}\n`);
  } catch (err) {
    process.stdout.write(`\x1b[31mfailed\x1b[0m\n`);
    throw err;
  } finally {
    await fs.rm(tempFile, { force: true }).catch(() => {});
  }
}

async function main() {
  const branch = process.argv[2] || 'chrome/m142';
  console.log(`${SYMBOL_STEP} Fetching Skia headers (${BRIGHT}${branch}${RESET})`);

  await fs.rm(inputHeadersDir, { recursive: true, force: true });
  await ensureDir(inputHeadersDir);

  const baseUrl = `https://skia.googlesource.com/skia/+archive/refs/heads/${branch}`;
  
  await fetchTarball(`${baseUrl}/include.tar.gz`, path.join(inputHeadersDir, 'include'));
  await fetchTarball(`${baseUrl}/modules.tar.gz`, path.join(inputHeadersDir, 'modules'));

  await fetchTarball(`${baseUrl}/src/core.tar.gz`, path.join(inputHeadersDir, 'src', 'core'));
  await fetchTarball(`${baseUrl}/src/base.tar.gz`, path.join(inputHeadersDir, 'src', 'base'));
  await fetchTarball(`${baseUrl}/src/utils.tar.gz`, path.join(inputHeadersDir, 'src', 'utils'));
  await fetchTarball(`${baseUrl}/src/codec.tar.gz`, path.join(inputHeadersDir, 'src', 'codec'));
  await fetchTarball(`${baseUrl}/src/ports.tar.gz`, path.join(inputHeadersDir, 'src', 'ports'));
  
  const preservedSources = [
    "modules/jsonreader/SkJSONReader.cpp",
    "modules/skresources/src/SkResources.cpp",
    "modules/skresources/src/SkAnimCodecPlayer.cpp",
    "src/utils/SkOSPath.cpp",
    "src/codec/SkCodecImageGenerator.cpp",
    "src/codec/SkPixmapUtils.cpp",
    "src/base/SkBase64.cpp",
    "src/core/SkAutoPixmapStorage.cpp",
    "src/ports/SkOSFile_posix.cpp",
  ];

  process.stdout.write(`  ${SYMBOL_SUBSTEP} Cleaning up files... `);
  // Remove all non-header files except for the ones we want to preserve
  execSync(`find "${inputHeadersDir}" -type f ! -name "*.h" ! -name "*.inc" | while read file; do
    rel_path=$(echo "$file" | sed "s|${inputHeadersDir}/||")
    keep=0
    for p in ${preservedSources.join(' ')}; do
      if [ "$rel_path" = "$p" ]; then
        keep=1
        break
      fi
    done
    if [ "$keep" = 0 ]; then
      rm "$file"
    fi
  done`);
  execSync(`find "${inputHeadersDir}" -type d -empty -delete`);
  process.stdout.write(`${GREEN}done${RESET}\n`);

  console.log(`\n${SYMBOL_SUCCESS} Headers and necessary sources fetched to ${DIM}input/headers/skia${RESET}`);
}

main().catch(error => {
  console.error(`\n\x1b[31mError:\x1b[0m ${error.message}`);
  process.exit(1);
});
