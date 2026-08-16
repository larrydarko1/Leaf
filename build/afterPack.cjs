/**
 * 1. Drop onnxruntime-node's prebuilt binaries for platforms we are not building. The npm package
 *    ships darwin + linux + win32 (~259 MB) and the loader only ever touches one of them, so the
 *    rest is dead weight in every installer.
 * 2. Ad-hoc code sign macOS app bundles. Without this, unsigned apps downloaded from the internet
 *    are rejected as "corrupted" by Gatekeeper on macOS Ventura+ (13+). Ad-hoc signing makes macOS
 *    show "unidentified developer" instead, which users can bypass with right-click → Open.
 * Order matters: pruning has to happen before signing, or the signature covers files that are no
 * longer there and macOS rejects the bundle.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARCH_NAMES = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' };

function pruneOnnxRuntime(context) {
    const resourcesDir = context.packager.getResourcesDir(context.appOutDir);
    const binDir = path.join(
        resourcesDir,
        'app.asar.unpacked',
        'node_modules',
        'onnxruntime-node',
        'bin',
    );

    if (!fs.existsSync(binDir)) {
        console.warn(`[afterPack] onnxruntime bin dir not found, skipping prune: ${binDir}`);
        return;
    }

    const keepPlatform = context.electronPlatformName; // 'darwin' | 'linux' | 'win32'
    const arch = ARCH_NAMES[context.arch];
    const keepArches = arch === 'universal' ? ['x64', 'arm64'] : [arch];

    let removed = 0;
    // bin/<napi-vN>/<platform>/<arch>. Directory entries are read with withFileTypes so a symlink
    // is never mistaken for a directory and followed out of the build tree.
    for (const napi of dirsIn(binDir)) {
        const napiDir = path.join(binDir, napi);

        for (const platform of dirsIn(napiDir)) {
            const platformDir = path.join(napiDir, platform);

            if (platform !== keepPlatform) {
                removed += sizeOf(platformDir);
                fs.rmSync(platformDir, { recursive: true, force: true });
                console.log(`[afterPack] pruned ${napi}/${platform}`);
                continue;
            }

            for (const archDir of dirsIn(platformDir)) {
                if (keepArches.includes(archDir)) continue;
                removed += sizeOf(path.join(platformDir, archDir));
                fs.rmSync(path.join(platformDir, archDir), { recursive: true, force: true });
                console.log(`[afterPack] pruned ${napi}/${platform}/${archDir}`);
            }
        }
    }

    console.log(
        `[afterPack] onnxruntime prune freed ${(removed / 1024 / 1024).toFixed(0)} MB (kept ${keepPlatform}/${keepArches.join(',')})`,
    );
}

function dirsIn(dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
}

function sizeOf(dir) {
    let total = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        total += entry.isDirectory() ? sizeOf(full) : fs.statSync(full).size;
    }
    return total;
}

function adhocSign(context) {
    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(context.appOutDir, `${appName}.app`);

    console.log(`[afterPack] Ad-hoc signing: ${appPath}`);

    try {
        // --force: replace any existing signature
        // --deep:  recursively sign nested code (frameworks, helpers)
        // --sign -: ad-hoc identity (no certificate required)
        execSync(`codesign --force --deep --sign - "${appPath}"`, {
            stdio: 'inherit',
        });
        console.log('[afterPack] Ad-hoc signing complete');
    } catch (error) {
        console.warn('[afterPack] Ad-hoc signing failed (non-fatal):', error.message);
        // Don't fail the build — the app will still work locally,
        // just won't pass Gatekeeper when downloaded from the internet.
    }
}

exports.default = async function (context) {
    pruneOnnxRuntime(context);

    if (context.electronPlatformName === 'darwin') adhocSign(context);
};
