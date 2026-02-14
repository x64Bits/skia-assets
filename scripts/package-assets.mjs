import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

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
const inputDir = path.join(rootDir, 'input');
const outputDir = path.join(rootDir, 'output');
const tempExtractDir = path.join(rootDir, '.tmp_extract');

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  const data = await fs.readFile(filePath);
  hash.update(data);
  return hash.digest('hex');
}

async function tar(srcDir, destFile) {
  process.stdout.write(`  ${SYMBOL_SUBSTEP} Packaging: ${path.basename(destFile)}... `);
  execSync(`tar -czf "${destFile}" --exclude='.DS_Store' -C "${srcDir}" .`);
  process.stdout.write(`${GREEN}done${RESET}\n`);
}

const ARCH_MAP = {
  'arm64-v8a': 'arm-64',
  'x86_64': 'arm-x64',
  'x86': 'arm-x86',
  'armeabi-v7a': 'arm-v7'
};

const INPUT_PATTERNS = {
  'arm64-v8a': ['arm-64', 'arm64-v8a'],
  'x86_64': ['x64', 'x86_64'],
  'x86': ['x86', 'i386'],
  'armeabi-v7a': ['arm-v7', 'armeabi-v7a', 'android-arm-skia']
};

async function main() {
  const version = process.argv[2];
  if (!version) {
    console.error(`${SYMBOL_STEP} Usage: npm run package <version>`);
    process.exit(1);
  }

  console.log(`${SYMBOL_STEP} Orchestrating Skia Assets (${BRIGHT}${version}${RESET})`);

  // Fresh start
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.rm(tempExtractDir, { recursive: true, force: true });
  await ensureDir(outputDir);

  const artifacts = [];
  const binariesInput = path.join(inputDir, 'binaries');
  const files = await fs.readdir(binariesInput).catch(() => []);

  // 1. Android Binaries
  for (const [arch, patterns] of Object.entries(INPUT_PATTERNS)) {
    const file = files.find(f => 
      patterns.some(p => f.includes(p)) && 
      f.endsWith('.tar.gz') && 
      !f.includes('ios') && !f.includes('macos')
    );
    
    if (!file) continue;

    const mappedName = ARCH_MAP[arch];
    const tarName = `skia-graphite-android-${mappedName}-${version}.tar.gz`;
    const tarPath = path.join(outputDir, tarName);
    const archivePath = path.join(binariesInput, file);

    console.log(`  ${SYMBOL_STEP} Processing Android [${DIM}${arch}${RESET}]`);
    
    const tmpExtract = path.join(tempExtractDir, arch);
    await ensureDir(tmpExtract);
    execSync(`tar -xzf "${archivePath}" -C "${tmpExtract}"`);
    
    const entries = await fs.readdir(tmpExtract);
    let contentRoot = tmpExtract;
    if (entries.length === 1 && (await fs.stat(path.join(tmpExtract, entries[0]))).isDirectory()) {
      contentRoot = path.join(tmpExtract, entries[0]);
    }

    await tar(contentRoot, tarPath);
    artifacts.push({ id: `android-${arch}`, name: tarName, sha256: await sha256(tarPath) });
    await fs.rm(tmpExtract, { recursive: true, force: true });
  }

  // 2. iOS Binaries
  const iosFiles = files.filter(f => f.includes('ios') && f.endsWith('.tar.gz'));
  if (iosFiles.length > 0) {
    console.log(`  ${SYMBOL_STEP} Processing iOS [${DIM}combined${RESET}]`);
    const tarName = `skia-graphite-apple-ios-xcframeworks-${version}.tar.gz`;
    const tarPath = path.join(outputDir, tarName);
    const tmpExtract = path.join(tempExtractDir, 'ios-combined');
    
    await ensureDir(tmpExtract);
    for (const file of iosFiles) {
      execSync(`tar -xzf "${path.join(binariesInput, file)}" -C "${tmpExtract}"`);
    }

    const entries = await fs.readdir(tmpExtract);
    let contentRoot = tmpExtract;
    if (entries.length === 1 && entries[0] === 'ios') {
      contentRoot = path.join(tmpExtract, 'ios');
    }

    await tar(contentRoot, tarPath);
    artifacts.push({ id: 'ios-xcframeworks', name: tarName, sha256: await sha256(tarPath) });
    await fs.rm(tmpExtract, { recursive: true, force: true });
  }

  // 3. Headers
  const headersInput = path.join(inputDir, 'headers', 'skia');
  if (await fs.stat(headersInput).catch(() => null)) {
    console.log(`  ${SYMBOL_STEP} Processing Headers`);
    const tarName = `skia-graphite-headers-${version}.tar.gz`;
    const tarPath = path.join(outputDir, tarName);
    
    await tar(headersInput, tarPath);
    artifacts.push({ id: 'skia-headers', name: tarName, sha256: await sha256(tarPath) });
  }

  console.log(`\n${SYMBOL_SUCCESS} Successfully packaged ${artifacts.length} artifacts`);
  
  await fs.writeFile(
    path.join(outputDir, 'release-manifest.json'), 
    JSON.stringify({ version, artifacts, timestamp: new Date().toISOString() }, null, 2)
  );
}

main().catch(error => {
  console.error(`\n\x1b[31mError:\x1b[0m ${error.message}`);
  process.exit(1);
});
