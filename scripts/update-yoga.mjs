import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const inputDir = path.join(rootDir, 'input');
const binariesDir = path.join(inputDir, 'binaries', 'yoga');
const headersDir = path.join(inputDir, 'headers', 'yoga');
const tempDir = path.join(rootDir, '.tmp_yoga');

const NDK_PATH = '/Users/zsaboi/Library/Android/sdk/ndk/26.1.10909125';
const CMAKE_PATH = '/Users/zsaboi/Library/Android/sdk/cmake/3.22.1/bin/cmake';

const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];
const ANDROID_PLATFORM = 21;

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function main() {
  let version = process.argv[2] || '3.2.1';
  if (version.startsWith('v')) {
    version = version.substring(1);
  }
  console.log(`◆ Updating Yoga to version ${version}`);

  // 1. Download Yoga
  const yogaUrl = `https://github.com/facebook/yoga/archive/refs/tags/v${version}.tar.gz`;
  const yogaDir = path.join(tempDir, `yoga-${version}`);
  
  await fs.rm(tempDir, { recursive: true, force: true });
  await ensureDir(tempDir);
  
  console.log(`  ➔ Fetching Yoga source...`);
  execSync(`curl -L "${yogaUrl}" -o "${tempDir}/yoga.tar.gz"`);
  execSync(`tar -xzf "${tempDir}/yoga.tar.gz" -C "${tempDir}"`);
  
  // Patch yoga/CMakeLists.txt to allow shared library build
  const yogaCMakePath = path.join(yogaDir, 'yoga', 'CMakeLists.txt');
  let cmakeContent = await fs.readFile(yogaCMakePath, 'utf8');
  cmakeContent = cmakeContent.replace('add_library(yogacore STATIC', 'add_library(yogacore');
  await fs.writeFile(yogaCMakePath, cmakeContent);
  
  // 2. Build for each ABI
  for (const abi of ABIS) {
    console.log(`  ◆ Building for ${abi}...`);
    const buildDir = path.join(tempDir, `build-${abi}`);
    const installDir = path.join(tempDir, `install-${abi}`);
    await ensureDir(buildDir);
    
    const cmakeCmd = [
      `"${CMAKE_PATH}"`,
      `-S "${yogaDir}"`,
      `-B "${buildDir}"`,
      `-DANDROID_ABI=${abi}`,
      `-DANDROID_NDK="${NDK_PATH}"`,
      `-DANDROID_PLATFORM=android-${ANDROID_PLATFORM}`,
      `-DCMAKE_TOOLCHAIN_FILE="${NDK_PATH}/build/cmake/android.toolchain.cmake"`,
      `-DBUILD_SHARED_LIBS=ON`,
      `-DCMAKE_INSTALL_PREFIX="${installDir}"`,
      `-DCMAKE_BUILD_TYPE=Release`
    ].join(' ');
    
    execSync(cmakeCmd, { stdio: 'inherit' });
    execSync(`"${CMAKE_PATH}" --build "${buildDir}" --config Release --target yogacore`, { stdio: 'inherit' });
    
    // Copy the library
    const abiBinaryDir = path.join(binariesDir, 'android', abi);
    await ensureDir(abiBinaryDir);
    
    // Yoga's CMake produces libyogacore.so, but we want libyoga.so
    const libPath = path.join(buildDir, 'yoga', 'libyogacore.so');
    await fs.copyFile(libPath, path.join(abiBinaryDir, 'libyoga.so'));
    console.log(`  ✔ Copied libyoga.so for ${abi}`);
  }

  // 3. Copy Headers
  console.log(`  ◆ Copying headers...`);
  await fs.rm(headersDir, { recursive: true, force: true });
  await ensureDir(headersDir);
  
  // We need the yoga/*.h files
  const yogaSrcDir = path.join(yogaDir, 'yoga');
  const files = await fs.readdir(yogaSrcDir);
  for (const file of files) {
    if (file.endsWith('.h')) {
      await fs.copyFile(path.join(yogaSrcDir, file), path.join(headersDir, file));
    }
  }
  
  // Also copy subdirectories if any (e.g. yoga/style, etc. - actually Yoga v3 has some subfolders)
  // Let's check what's inside yoga/ in v3.2.1
  const entries = await fs.readdir(yogaSrcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
       const subDir = path.join(yogaSrcDir, entry.name);
       const destSubDir = path.join(headersDir, entry.name);
       await ensureDir(destSubDir);
       const subFiles = await fs.readdir(subDir);
       for (const subFile of subFiles) {
         if (subFile.endsWith('.h')) {
           await fs.copyFile(path.join(subDir, subFile), path.join(destSubDir, subFile));
         }
       }
    }
  }

  console.log(`\n✔ Successfully built Yoga ${version} for Android`);
  // await fs.rm(tempDir, { recursive: true, force: true });
}

main().catch(error => {
  console.error(`\n\x1b[31mError:\x1b[0m ${error.message}`);
  process.exit(1);
});
