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

  process.stdout.write(`  ${SYMBOL_SUBSTEP} Cleaning up modules... `);
  execSync(`find "${path.join(inputHeadersDir, 'modules')}" -type f ! -name "*.h" ! -name "*.inc" -delete`);
  execSync(`find "${path.join(inputHeadersDir, 'modules')}" -type d -empty -delete`);
  process.stdout.write(`${GREEN}done${RESET}\n`);

  await fetchTarball(`${baseUrl}/src/core.tar.gz`, path.join(inputHeadersDir, 'src', 'core'));
  await fetchTarball(`${baseUrl}/src/base.tar.gz`, path.join(inputHeadersDir, 'src', 'base'));
  
  process.stdout.write(`  ${SYMBOL_SUBSTEP} Cleaning up src... `);
  execSync(`find "${path.join(inputHeadersDir, 'src')}" -type f ! -name "*.h" ! -name "*.inc" -delete`);
  execSync(`find "${path.join(inputHeadersDir, 'src')}" -type d -empty -delete`);
  process.stdout.write(`${GREEN}done${RESET}\n`);

  console.log(`\n${SYMBOL_SUCCESS} Headers fetched to ${DIM}input/headers/skia${RESET}`);
}

main().catch(error => {
  console.error(`\n\x1b[31mError:\x1b[0m ${error.message}`);
  process.exit(1);
});
